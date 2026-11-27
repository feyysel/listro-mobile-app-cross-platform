import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(payload: NotificationPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: (payload.data ?? {}) as object,
      },
    });

    return notification;
  }

  async notifyMany(userIds: string[], payload: Omit<NotificationPayload, 'userId'>) {
    return Promise.all(userIds.map((userId) => this.notify({ ...payload, userId })));
  }

  async findMine(userId: string, page: number, limit: number, onlyUnread: boolean) {
    const where = { userId, ...(onlyUnread ? { isRead: false } : {}) };
    const [items, unreadCount, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      unreadCount,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return null;

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
