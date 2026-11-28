import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DeliveryStatus } from '../generated/prisma/client.js';
import { assertDeliveryTransition } from './delivery-transitions.js';

describe('delivery transitions', () => {
  it('allows pickup and return progress', () => {
    expect(() =>
      assertDeliveryTransition(DeliveryStatus.ASSIGNED, DeliveryStatus.IN_PROGRESS),
    ).not.toThrow();
    expect(() =>
      assertDeliveryTransition(DeliveryStatus.IN_PROGRESS, DeliveryStatus.COMPLETED),
    ).not.toThrow();
  });

  it('rejects skipping stages', () => {
    expect(() =>
      assertDeliveryTransition(DeliveryStatus.ASSIGNED, DeliveryStatus.COMPLETED),
    ).toThrow(BadRequestException);
  });

  it('rejects transitions from completed deliveries', () => {
    expect(() =>
      assertDeliveryTransition(DeliveryStatus.COMPLETED, DeliveryStatus.IN_PROGRESS),
    ).toThrow(BadRequestException);
  });
});
