import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../generated/prisma/client.js';

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
];

export const LIVE_ORDER_STATUSES: OrderStatus[] = Object.values(OrderStatus).filter(
  (status) => !TERMINAL_ORDER_STATUSES.includes(status),
);

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED,
  ],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.DELIVERY_ASSIGNED,
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED,
  ],
  [OrderStatus.DELIVERY_ASSIGNED]: [
    OrderStatus.PICKUP_IN_PROGRESS,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PICKUP_IN_PROGRESS]: [
    OrderStatus.RECEIVED_AT_CENTER,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.RECEIVED_AT_CENTER]: [OrderStatus.WASHING_IN_PROGRESS],
  [OrderStatus.WASHING_IN_PROGRESS]: [OrderStatus.WASHING_COMPLETED],
  [OrderStatus.WASHING_COMPLETED]: [OrderStatus.READY_FOR_DELIVERY],
  [OrderStatus.READY_FOR_DELIVERY]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.READY_FOR_DELIVERY,
  ],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
};

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!ORDER_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(
      `Cannot change order from ${from} to ${to}`,
    );
  }
}
