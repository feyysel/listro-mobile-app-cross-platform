import { describe, expect, it, vi } from 'vitest';
import { RealtimeService } from './realtime.service.js';

describe('RealtimeService', () => {
  it('publishes a message to every subscriber of a user', () => {
    const prisma = { notification: { findMany: vi.fn() } };
    const service = new RealtimeService(prisma as never);
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = service.subscribe('user-1', first);
    const unsubscribeSecond = service.subscribe('user-1', second);
    service.subscribe('user-2', vi.fn());

    service.publishToUsers(['user-1'], {
      type: 'notification',
      data: { id: 'notification-1' },
    });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(first.mock.calls[0][0]).toMatchObject({
      type: 'notification',
      data: { id: 'notification-1' },
    });

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('maps stored notifications to replayable events', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'notification-1',
            type: 'order.status',
            title: 'Order updated',
            message: 'Status changed',
            data: { orderId: 'order-1' },
            isRead: false,
            createdAt,
          },
        ]),
      },
    };
    const service = new RealtimeService(prisma as never);

    const events = await service.recentNotifications(
      'user-1',
      new Date('2025-12-31T00:00:00.000Z'),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'notification:notification-1',
      type: 'notification',
      data: { id: 'notification-1', data: { orderId: 'order-1' } },
    });
  });
});
