import { BadRequestException } from '@nestjs/common';
import { DeliveryStatus } from '../generated/prisma/client.js';

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.ASSIGNED]: [
    DeliveryStatus.IN_PROGRESS,
    DeliveryStatus.FAILED,
    DeliveryStatus.CANCELLED,
  ],
  [DeliveryStatus.IN_PROGRESS]: [DeliveryStatus.COMPLETED, DeliveryStatus.FAILED],
  [DeliveryStatus.COMPLETED]: [],
  [DeliveryStatus.FAILED]: [DeliveryStatus.ASSIGNED],
  [DeliveryStatus.CANCELLED]: [DeliveryStatus.ASSIGNED],
};

export function assertDeliveryTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
): void {
  if (!DELIVERY_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(`Cannot change delivery from ${from} to ${to}`);
  }
}
