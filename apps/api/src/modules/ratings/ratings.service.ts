import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findForOrder(user: AuthenticatedUser, orderId: string) {
    await this.ordersService.findOne(user, orderId);
    return this.prisma.rating.findUnique({ where: { orderId } });
  }

  async submit(
    user: AuthenticatedUser,
    orderId: string,
    input: { score: number; comment?: string | null },
  ) {
    await this.ordersService.findOne(user, orderId);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, customerId: true, bookingCode: true },
    });
    if (!order) throw new BadRequestException('Order not found');
    if (order.customerId !== user.customerId) {
      throw new ForbiddenException('You can only rate your own orders');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('You can rate only after the order is delivered');
    }

    const rating = await this.prisma.rating.upsert({
      where: { orderId },
      create: {
        orderId,
        customerId: order.customerId,
        score: input.score,
        comment: input.comment ?? null,
      },
      update: { score: input.score, comment: input.comment ?? null },
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'ORDER_RATED',
      entityType: 'Rating',
      entityId: rating.id,
      description: `Order ${order.bookingCode} rated ${input.score}/5`,
      metadata: { orderId, score: input.score },
    });

    const managers = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.MANAGER, UserRole.ADMIN] }, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notificationsService.notifyMany(managers.map((manager) => manager.id), {
      type: 'order.rated',
      title: 'New service rating',
      message: `Order ${order.bookingCode} was rated ${input.score}/5.`,
      data: { orderId, ratingId: rating.id, score: input.score },
    });

    return rating;
  }
}
