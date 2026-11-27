import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OrderStatus } from '../generated/prisma/client.js';
import { assertOrderTransition } from './order-transitions.js';

describe('order transitions', () => {
  it('allows the happy path', () => {
    expect(() =>
      assertOrderTransition(OrderStatus.PLACED, OrderStatus.CONFIRMED),
    ).not.toThrow();
    expect(() =>
      assertOrderTransition(
        OrderStatus.WASHING_COMPLETED,
        OrderStatus.READY_FOR_DELIVERY,
      ),
    ).not.toThrow();
  });

  it('rejects skipping workflow stages', () => {
    expect(() =>
      assertOrderTransition(OrderStatus.PLACED, OrderStatus.DELIVERED),
    ).toThrow(BadRequestException);
  });

  it('rejects transitions out of terminal states', () => {
    expect(() =>
      assertOrderTransition(OrderStatus.DELIVERED, OrderStatus.READY_FOR_DELIVERY),
    ).toThrow(BadRequestException);
    expect(() =>
      assertOrderTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED),
    ).toThrow(BadRequestException);
  });
});
