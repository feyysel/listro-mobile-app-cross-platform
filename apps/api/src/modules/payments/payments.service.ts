import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  kind?: PaymentKind;
  status?: 'PENDING' | 'COMPLETED';
  transactionReference?: string | null;
  provider?: string | null;
  notes?: string | null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async findForOrder(user: AuthenticatedUser, orderId: string) {
    await this.ordersService.findOne(user, orderId);
    return this.prisma.payment.findMany({
      where: { orderId },
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.payment.findMany({
      include: {
        order: {
          select: {
            bookingCode: true,
            status: true,
            customer: {
              select: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async outstanding(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const paid = await this.prisma.payment.aggregate({
      where: { orderId, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    const total = Number(order.totalAmount);
    const alreadyPaid = Number(paid._sum.amount ?? 0);
    return { order, total, alreadyPaid, outstanding: Math.max(0, total - alreadyPaid) };
  }

  private async completedByKind(orderId: string, kind: PaymentKind) {
    const result = await this.prisma.payment.aggregate({
      where: { orderId, kind, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async requirements(user: AuthenticatedUser, orderId: string) {
    const balance = await this.outstanding(orderId);
    await this.ordersService.findOne(user, orderId);
    const depositPaid = await this.completedByKind(orderId, PaymentKind.DEPOSIT);
    const depositRequired = Math.ceil(balance.total * 50) / 100;
    const depositMissing = Math.max(0, depositRequired - depositPaid);
    return {
      orderId,
      total: balance.total,
      depositRequired,
      depositPaid,
      depositMissing,
      depositComplete: depositMissing <= 0,
      outstanding: balance.outstanding,
      fullyPaid: balance.outstanding <= 0,
      status: balance.order.status,
    };
  }

  async record(
    user: AuthenticatedUser,
    orderId: string,
    input: PaymentInput,
    idempotencyKey?: string,
  ) {
    await this.ordersService.findOne(user, orderId);
    const isStaff = [UserRole.MANAGER, UserRole.ADMIN].some((value) => value === user.role);
    const kind = input.kind ?? PaymentKind.DEPOSIT;
    if (input.method === PaymentMethod.CASH && !isStaff) {
      throw new ForbiddenException('Only authorized staff can record cash payments');
    }
    if (input.amount <= 0) throw new BadRequestException('Amount must be positive');

    const balance = await this.outstanding(orderId);
    const depositPaid = await this.completedByKind(orderId, PaymentKind.DEPOSIT);
    const depositRequired = Math.ceil(balance.total * 50) / 100;
    const status = balance.order.status as OrderStatus;

    const finalWindow: OrderStatus[] = [
      OrderStatus.READY_FOR_DELIVERY,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    ];
    if (!isStaff && kind === PaymentKind.FINAL && !finalWindow.includes(status)) {
      throw new BadRequestException(
        'Final payment is available once the order is ready for return delivery',
      );
    }
    if (
      !isStaff &&
      kind === PaymentKind.DEPOSIT &&
      ![OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.DELIVERY_ASSIGNED].some(
        (value) => value === status,
      )
    ) {
      throw new BadRequestException('The deposit window for this order is closed');
    }
    if (kind === PaymentKind.DEPOSIT) {
      if (depositPaid >= depositRequired) {
        throw new BadRequestException('The 50% deposit has already been satisfied');
      }
      if (input.amount < depositRequired - depositPaid) {
        throw new BadRequestException('Deposit must be at least 50% of the order total');
      }
    } else if (balance.outstanding <= 0) {
      throw new BadRequestException('Order is already fully paid');
    } else if (input.amount > balance.outstanding) {
      throw new BadRequestException('Payment exceeds the outstanding balance');
    }

    const requestedStatus =
      input.method === PaymentMethod.CASH && isStaff
        ? (input.status ?? PaymentStatus.COMPLETED)
        : PaymentStatus.PENDING;

    if (
      requestedStatus === PaymentStatus.COMPLETED &&
      kind === PaymentKind.FINAL &&
      input.amount > balance.outstanding
    ) {
      throw new BadRequestException('Payment exceeds the outstanding balance');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (existing && existing.expiresAt > new Date()) {
        const cached = existing.responseJson as { id?: string };
        if (cached.id) {
          const payment = await this.prisma.payment.findUnique({
            where: { id: cached.id },
          });
          if (payment) return payment;
        }
      }
    }

    const reference =
      input.transactionReference ?? `PMT-${randomBytes(6).toString('hex').toUpperCase()}`;

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId,
          recordedByUserId: isStaff ? user.id : null,
          amount: input.amount,
          currency: 'ETB',
          kind,
          method: input.method,
          status: requestedStatus,
          provider: input.provider ?? (input.method === PaymentMethod.CASH ? 'CASH' : 'MANUAL'),
          transactionReference: reference,
          notes: input.notes,
          paidAt: requestedStatus === PaymentStatus.COMPLETED ? new Date() : null,
        },
      });

      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            userId: user.id,
            scope: 'payment.create',
            requestHash: createHash('sha256')
              .update(JSON.stringify({ orderId, input }))
              .digest('hex'),
            responseJson: { id: created.id },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
      return created;
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: payment.id,
      description: `${kind} payment of ${input.amount} recorded with status ${requestedStatus}`,
      metadata: { orderId, method: input.method, kind },
    });

    if (requestedStatus === PaymentStatus.PENDING) {
      const managers = await this.prisma.user.findMany({
        where: { role: { in: [UserRole.MANAGER, UserRole.ADMIN] }, status: 'ACTIVE' },
        select: { id: true },
      });
      await this.notificationsService.notifyMany(
        managers.filter((manager) => manager.id !== user.id).map((manager) => manager.id),
        {
          type: 'payment.recorded',
          title: `${kind === PaymentKind.DEPOSIT ? 'Deposit' : 'Final payment'} awaiting verification`,
          message: `Payment ${reference} for order ${balance.order.bookingCode} is awaiting verification.`,
          data: { orderId, paymentId: payment.id, kind },
        },
      );
    } else {
      const customer = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { customer: { select: { userId: true } } },
      });
      if (customer) {
        await this.notificationsService.notify({
          userId: customer.customer.userId,
          type: 'payment.status',
          title: 'Payment confirmed',
          message: `Your ${kind === PaymentKind.DEPOSIT ? 'deposit' : 'final payment'} for order ${balance.order.bookingCode} was confirmed.`,
          data: { orderId, paymentId: payment.id, kind, status: requestedStatus },
        });
      }
    }
    return payment;
  }

  async verify(
    id: string,
    actor: AuthenticatedUser,
    input: { status: PaymentStatus; providerReference?: string; notes?: string },
  ) {
    if (![UserRole.MANAGER, UserRole.ADMIN].some((value) => value === actor.role)) {
      throw new ForbiddenException('Only authorized staff can verify payments');
    }
    if (![PaymentStatus.COMPLETED, PaymentStatus.FAILED].some((value) => value === input.status)) {
      throw new BadRequestException('Verification must complete or fail a payment');
    }

    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.COMPLETED && input.status === PaymentStatus.COMPLETED) {
      return payment;
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: input.status,
        providerReference: input.providerReference ?? payment.providerReference,
        notes: input.notes ?? payment.notes,
        paidAt: input.status === PaymentStatus.COMPLETED ? new Date() : null,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PAYMENT_VERIFIED',
      entityType: 'Payment',
      entityId: id,
      description: `Payment moved from ${payment.status} to ${input.status}`,
      metadata: { orderId: payment.orderId },
    });

    const customer = await this.prisma.order.findUnique({
      where: { id: payment.orderId },
      select: { customer: { select: { userId: true } } },
    });
    if (customer) {
      await this.notificationsService.notify({
        userId: customer.customer.userId,
        type: 'payment.status',
        title: 'Payment update',
        message: `Your payment is now ${input.status.toLowerCase()}.`,
        data: { paymentId: id, orderId: payment.orderId, status: input.status },
      });
    }
    return updated;
  }

  async handleWebhook(provider: string, rawBody: string, signature: string | undefined) {
    const secret = this.configService.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signature ?? '';
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    let event: {
      transactionReference?: string;
      providerReference?: string;
      status?: string;
    };
    try {
      event = JSON.parse(rawBody) as typeof event;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
    if (!event.transactionReference || !event.status) {
      throw new BadRequestException('Missing webhook fields');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { transactionReference: event.transactionReference },
    });
    if (!payment) throw new NotFoundException('Payment reference not found');
    if (payment.provider !== provider) {
      throw new BadRequestException('Webhook provider mismatch');
    }

    const status =
      event.status === 'COMPLETED'
        ? PaymentStatus.COMPLETED
        : event.status === 'FAILED'
          ? PaymentStatus.FAILED
          : PaymentStatus.PROCESSING;

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        providerReference: event.providerReference ?? payment.providerReference,
        paidAt: status === PaymentStatus.COMPLETED ? new Date() : null,
      },
    });

    await this.auditService.record({
      actorUserId: null,
      action: 'PAYMENT_WEBHOOK',
      entityType: 'Payment',
      entityId: payment.id,
      description: `Webhook from ${provider} set status ${status}`,
      metadata: { provider, transactionReference: event.transactionReference },
    });

    const customer = await this.prisma.order.findUnique({
      where: { id: payment.orderId },
      select: { bookingCode: true, customer: { select: { userId: true } } },
    });
    if (customer) {
      await this.notificationsService.notify({
        userId: customer.customer.userId,
        type: 'payment.status',
        title: 'Payment update',
        message: `Payment for order ${customer.bookingCode} is now ${status.toLowerCase()}.`,
        data: { orderId: payment.orderId, paymentId: payment.id, kind: payment.kind, status },
      });
    }
    return updated;
  }

  async refund(id: string, actor: AuthenticatedUser, reason: string) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can refund payments');
    }
    const payment = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.REFUNDED, notes: reason },
    });
    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PAYMENT_REFUND',
      entityType: 'Payment',
      entityId: id,
      description: 'Payment refunded',
      metadata: { reason, orderId: payment.orderId },
    });
    return payment;
  }
}
