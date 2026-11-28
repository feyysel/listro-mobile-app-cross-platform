import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  OrderStatus,
  PaymentKind,
  PaymentStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import {
  assertOrderTransition,
  LIVE_ORDER_STATUSES,
} from '../../common/order-transitions.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CreateOrderInput {
  pickupAddressId: string;
  returnAddressId?: string | null;
  branchId?: string | null;
  customerNotes?: string | null;
  preferredPickupAt?: string | null;
  items: Array<{
    serviceId: string;
    shoeCategory: string;
    shoeBrand?: string | null;
    shoeModel?: string | null;
    shoeColor?: string | null;
    conditionNotes?: string | null;
    quantity?: number;
  }>;
}

const bookingCode = () =>
  `LST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;

const money = (value: unknown) => Number(value);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async customerIdFor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { customer: { select: { id: true } } },
    });
    if (!user?.customer) throw new ForbiddenException('Customer profile required');
    return user.customer.id;
  }

  private async notifyCustomerAndManagers(
    customerUserId: string,
    payload: { type: string; title: string; message: string; data?: Record<string, unknown> },
  ) {
    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.MANAGER, UserRole.ADMIN] },
        status: 'ACTIVE',
        id: { not: customerUserId },
      },
      select: { id: true },
    });
    await this.notificationsService.notifyMany(
      [customerUserId, ...managers.map((m) => m.id)],
      payload,
    );
  }

  async create(
    user: AuthenticatedUser,
    input: CreateOrderInput,
    idempotencyKey?: string,
  ) {
    const customerId = await this.customerIdFor(user.id);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ customerId, input }))
      .digest('hex');

    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (existing && existing.expiresAt > new Date()) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictException('Idempotency key was used with a different request');
        }
        const cached = existing.responseJson as { id?: string };
        if (cached.id) return this.findOne(user, cached.id);
        return cached;
      }
    }

    const address = await this.prisma.address.findFirst({
      where: { id: input.pickupAddressId, customerId },
    });
    if (!address) throw new BadRequestException('Pickup address is not valid');

    if (input.returnAddressId) {
      const returnAddress = await this.prisma.address.findFirst({
        where: { id: input.returnAddressId, customerId },
      });
      if (!returnAddress) throw new BadRequestException('Return address is not valid');
    }

    const branch =
      (input.branchId
        ? await this.prisma.branch.findFirst({
            where: { id: input.branchId, status: 'ACTIVE' },
          })
        : await this.prisma.branch.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
          })) ?? null;
    if (!branch) throw new BadRequestException('No active cleaning center is available');

    if (!input.items.length) {
      throw new BadRequestException('At least one pair of shoes is required');
    }

    const pricedItems = await Promise.all(
      input.items.map(async (item) => {
        const quantity = item.quantity ?? 1;
        if (quantity < 1 || quantity > 20) {
          throw new BadRequestException('Quantity must be between 1 and 20');
        }
        const branchService = await this.prisma.branchService.findFirst({
          where: {
            branchId: branch.id,
            isActive: true,
            service: { id: item.serviceId, isActive: true },
          },
          include: { service: { select: { name: true } } },
        });
        if (!branchService) {
          throw new BadRequestException(`Service ${item.serviceId} is unavailable`);
        }
        const unitPrice = money(branchService.price);
        return {
          branchServiceId: branchService.id,
          serviceName: branchService.service.name,
          unitPrice,
          quantity,
          shoeCategory: item.shoeCategory,
          shoeBrand: item.shoeBrand,
          shoeModel: item.shoeModel,
          shoeColor: item.shoeColor,
          conditionNotes: item.conditionNotes,
          totalPrice: unitPrice * quantity,
        };
      }),
    );

    const subtotal = pricedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          bookingCode: bookingCode(),
          customerId,
          branchId: branch.id,
          pickupAddressId: address.id,
          returnAddressId: input.returnAddressId ?? null,
          status: OrderStatus.PLACED,
          subtotal,
          discount: 0,
          deliveryFee: 0,
          tax: 0,
          totalAmount: subtotal,
          customerNotes: input.customerNotes,
          items: {
            create: pricedItems.map((item) => ({
              branchServiceId: item.branchServiceId,
              serviceName: item.serviceName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
              shoeCategory: item.shoeCategory,
              shoeBrand: item.shoeBrand,
              shoeModel: item.shoeModel,
              shoeColor: item.shoeColor,
              conditionNotes: item.conditionNotes,
            })),
          },
          statusHistory: {
            create: {
              previousStatus: null,
              newStatus: OrderStatus.PLACED,
              changedByUserId: user.id,
              note: 'Order placed by customer',
            },
          },
        },
        include: { items: true },
      });

      const createdItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });
      await tx.washingTask.createMany({
        data: createdItems.map((item) => ({
          orderItemId: item.id,
          orderId: order.id,
          branchId: branch.id,
        })),
      });

      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            userId: user.id,
            scope: 'order.create',
            requestHash,
            responseJson: {
              id: order.id,
              bookingCode: order.bookingCode,
              status: order.status,
              totalAmount: subtotal,
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      return order;
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'ORDER_CREATE',
      entityType: 'Order',
      entityId: created.id,
      description: `Order ${created.bookingCode} placed`,
      metadata: { totalAmount: subtotal, itemCount: created.items.length },
    });

    await this.notifyCustomerAndManagers(user.id, {
      type: 'order.placed',
      title: 'Order placed',
      message: `Your order ${created.bookingCode} has been received.`,
      data: { orderId: created.id, status: OrderStatus.PLACED },
    });

    return this.findOne(user, created.id);
  }

  async findAll(
    user: AuthenticatedUser,
    options: {
      status?: OrderStatus;
      search?: string;
      page: number;
      limit: number;
      mineOnly?: boolean;
      liveOnly?: boolean;
      includePayments?: boolean;
    },
  ) {
    const isStaff =
      user.role !== UserRole.CUSTOMER && !options.mineOnly;
    const statusFilter = options.status
      ? { status: options.status }
      : options.liveOnly
        ? { status: { in: LIVE_ORDER_STATUSES } }
        : {};
    const where = {
      ...(!isStaff ? { customerId: user.customerId ?? '' } : {}),
      ...(isStaff && user.branchIds?.length
        ? { branchId: { in: user.branchIds } }
        : {}),
      ...statusFilter,
      ...(options.search
        ? {
            OR: [
              { bookingCode: { contains: options.search, mode: 'insensitive' as const } },
              { customer: { user: { firstName: { contains: options.search, mode: 'insensitive' as const } } } },
              { customer: { user: { lastName: { contains: options.search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              user: {
                select: { firstName: true, lastName: true, email: true, phone: true },
              },
            },
          },
          branch: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
          ...(options.includePayments
            ? {
                payments: {
                  orderBy: { createdAt: 'desc' as const },
                  select: {
                    id: true,
                    orderId: true,
                    kind: true,
                    amount: true,
                    method: true,
                    status: true,
                    transactionReference: true,
                    paidAt: true,
                    createdAt: true,
                  },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit),
      },
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        pickupAddress: true,
        returnAddress: true,
        items: {
          include: {
            washingTask: {
              include: { operator: { include: { user: { select: { firstName: true, lastName: true } } } } },
            },
            inspection: true,
          },
        },
        deliveries: {
          include: {
            employee: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: {
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    this.assertCanView(user, order);
    return order;
  }

  private assertCanView(
    user: AuthenticatedUser,
    order: {
      customerId: string;
      branchId: string | null;
      customer: { user: { id: string } };
    },
  ) {
    if (user.role === UserRole.CUSTOMER) {
      if (order.customer.user.id !== user.id) {
        throw new ForbiddenException('You cannot view this order');
      }
      return;
    }
    if (
      user.branchIds?.length &&
      (!order.branchId || !user.branchIds.includes(order.branchId))
    ) {
      throw new ForbiddenException('Order is outside your branch scope');
    }
  }

  async history(user: AuthenticatedUser, id: string) {
    const order = await this.findOne(user, id);
    return order.statusHistory;
  }

  async transition(
    orderId: string,
    to: OrderStatus,
    actor: AuthenticatedUser | { id: string; role?: UserRole },
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderTransition(order.status, to);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId },
        data: {
          status: to,
          ...(to === OrderStatus.CONFIRMED ? { confirmedAt: new Date() } : {}),
          ...(to === OrderStatus.DELIVERED ? { completedAt: new Date() } : {}),
          ...([OrderStatus.CANCELLED, OrderStatus.REJECTED].some((value) => value === to)
            ? { cancelledAt: new Date() }
            : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus: to,
          changedByUserId: actor.id,
          note: note ?? null,
        },
      });
      return result;
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'ORDER_STATUS_CHANGE',
      entityType: 'Order',
      entityId: orderId,
      description: `${order.status} -> ${to}`,
      metadata: { from: order.status, to, note },
    });

    const customerUser = await this.prisma.customer.findUnique({
      where: { id: order.customerId },
      select: { userId: true },
    });
    if (customerUser) {
      await this.notificationsService.notify({
        userId: customerUser.userId,
        type: 'order.status',
        title: `Order ${order.bookingCode} updated`,
        message: `Order status is now ${to.replaceAll('_', ' ').toLowerCase()}.`,
        data: { orderId, status: to },
      });
    }

    return updated;
  }

  async confirm(
    id: string,
    actor: AuthenticatedUser,
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { branchId: true, status: true, totalAmount: true, bookingCode: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (
      actor.branchIds?.length &&
      (!order.branchId || !actor.branchIds.includes(order.branchId))
    ) {
      throw new ForbiddenException('Order is outside your branch scope');
    }
    const deposit = await this.prisma.payment.aggregate({
      where: { orderId: id, kind: PaymentKind.DEPOSIT, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    const depositRequired = Math.ceil(Number(order.totalAmount) * 50) / 100;
    if (Number(deposit._sum.amount ?? 0) + 0.001 < depositRequired) {
      throw new BadRequestException(
        `A verified deposit of at least ${depositRequired} ETB is required before confirming ${order.bookingCode}`,
      );
    }
    // A branch may be assigned during confirmation of a PLACED order.
    if (order.status === OrderStatus.PLACED && actor.branchIds?.length) {
      await this.prisma.order.update({
        where: { id },
        data: { branchId: actor.branchIds[0] },
      });
    }
    const updated = await this.transition(id, OrderStatus.CONFIRMED, actor, note);
    const pickupStaff = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.MANAGER, UserRole.ADMIN, UserRole.DELIVERY] },
        status: 'ACTIVE',
        id: { not: actor.id },
      },
      select: { id: true },
    });
    await this.notificationsService.notifyMany(
      pickupStaff.map((user) => user.id),
      {
        type: 'order.confirmed',
        title: 'Order confirmed - pickup needed',
        message: `Order ${order.bookingCode} is confirmed and needs a pickup assignment.`,
        data: { orderId: id, status: OrderStatus.CONFIRMED },
      },
    );
    return updated;
  }

  async reject(id: string, actor: AuthenticatedUser, reason: string) {
    return this.transition(id, OrderStatus.REJECTED, actor, reason);
  }

  async cancel(id: string, actor: AuthenticatedUser, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: { select: { userId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if ([UserRole.DELIVERY, UserRole.OPERATOR].some((value) => value === actor.role)) {
      throw new ForbiddenException('Only managers and administrators can cancel an order');
    }
    if (
      actor.role === UserRole.CUSTOMER &&
      order.customer.userId !== actor.id
    ) {
      throw new ForbiddenException('You cannot cancel this order');
    }
    if (
      actor.role === UserRole.CUSTOMER &&
      ![OrderStatus.PLACED, OrderStatus.CONFIRMED].some((value) => value === order.status)
    ) {
      throw new ForbiddenException('This order can no longer be cancelled');
    }
    return this.transition(id, OrderStatus.CANCELLED, actor, reason);
  }

  async counts(user: AuthenticatedUser) {
    const where =
      user.role === UserRole.CUSTOMER
        ? { customerId: user.customerId ?? '' }
        : user.branchIds?.length
          ? { branchId: { in: user.branchIds } }
          : {};
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    return Object.fromEntries(
      rows.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<OrderStatus, number>>;
  }
}
