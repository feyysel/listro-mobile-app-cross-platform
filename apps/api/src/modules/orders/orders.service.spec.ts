import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../generated/prisma/client.js';
import { LIVE_ORDER_STATUSES } from '../../common/order-transitions.js';
import { OrdersService } from './orders.service.js';

function serviceWithMockPrisma() {
  const order = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  };
  const prisma = {
    order,
    $transaction: vi.fn(async () => [[], 0]),
  };
  const service = new OrdersService(prisma as never, {} as never, {} as never);
  return { service, order };
}

const manager = {
  id: 'user-1',
  role: UserRole.MANAGER,
  branchIds: ['branch-1'],
} as never;

describe('OrdersService.findAll', () => {
  it('limits the list to live statuses when liveOnly is requested', async () => {
    const { service, order } = serviceWithMockPrisma();

    await service.findAll(manager, { page: 1, limit: 20, liveOnly: true });

    expect(order.findMany.mock.calls[0][0].where.status.in).toEqual(
      LIVE_ORDER_STATUSES,
    );
  });

  it('includes payment records when requested', async () => {
    const { service, order } = serviceWithMockPrisma();

    await service.findAll(manager, {
      page: 1,
      limit: 20,
      status: 'DELIVERED' as never,
      includePayments: true,
    });

    expect(order.findMany.mock.calls[0][0].include.payments).toBeDefined();
  });
});
