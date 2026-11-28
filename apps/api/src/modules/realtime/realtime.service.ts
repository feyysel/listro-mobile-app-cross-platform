import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface RealtimeEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface RealtimeMessage {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

type Listener = (event: RealtimeEvent) => void;

@Injectable()
export class RealtimeService {
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(private readonly prisma: PrismaService) {}

  subscribe(userId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(userId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(userId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(userId);
    };
  }

  publishToUsers(userIds: string[], message: RealtimeMessage): void {
    const event: RealtimeEvent = {
      id: message.id ?? randomUUID(),
      type: message.type,
      data: message.data,
      createdAt: new Date().toISOString(),
    };
    for (const userId of new Set(userIds)) {
      for (const listener of this.listeners.get(userId) ?? []) {
        listener(event);
      }
    }
  }

  async recentNotifications(userId: string, since: Date): Promise<RealtimeEvent[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return rows.map((row) => ({
      id: `notification:${row.id}`,
      type: 'notification',
      data: {
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data ?? {},
        isRead: row.isRead,
        createdAt: row.createdAt.toISOString(),
      },
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
