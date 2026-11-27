import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryStatus,
  DeliveryType,
  OrderStatus,
  UserRole,
  WashingStatus,
} from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const staff = (user: AuthenticatedUser) =>
  user.role !== UserRole.CUSTOMER && user.role !== UserRole.DELIVERY;

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async employeeUser(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async notifyEmployee(employeeId: string, payload: { title: string; message: string; type: string; data?: Record<string, unknown> }) {
    const employee = await this.employeeUser(employeeId);
    await this.notificationsService.notify({ userId: employee.user.id, ...payload });
  }

  private async notifyRoles(
    roles: UserRole[],
    payload: { title: string; message: string; type: string; data?: Record<string, unknown> },
    excludeUserIds: string[] = [],
  ) {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notificationsService.notifyMany(
      users.map((user) => user.id).filter((id) => !excludeUserIds.includes(id)),
      payload,
    );
  }

  private async notifyCustomer(
    orderId: string,
    payload: { title: string; message: string; type: string; data?: Record<string, unknown> },
  ) {
    const customer = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { customer: { select: { userId: true } } },
    });
    if (customer) {
      await this.notificationsService.notify({ userId: customer.customer.userId, ...payload });
    }
  }

  async myDeliveries(user: AuthenticatedUser, status?: DeliveryStatus) {
    if (!user.employeeId) throw new ForbiddenException('Employee profile required');
    return this.prisma.delivery.findMany({
      where: {
        employeeId: user.employeeId,
        ...(status ? { status } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            bookingCode: true,
            status: true,
            customerNotes: true,
            totalAmount: true,
            customer: {
              select: {
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
        address: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async orderDeliveries(orderId: string) {
    return this.prisma.delivery.findMany({
      where: { orderId },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignPickup(
    orderId: string,
    employeeId: string,
    actor: AuthenticatedUser,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed orders can be assigned for pickup');
    }
    if (
      actor.branchIds?.length &&
      (!order.branchId || !actor.branchIds.includes(order.branchId))
    ) {
      throw new ForbiddenException('Order is outside your branch scope');
    }

    const delivery = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.delivery.findUnique({
        where: { orderId_type: { orderId, type: DeliveryType.PICKUP } },
      });
      const data = {
        employeeId,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
        addressId: order.pickupAddressId,
        scheduledAt: new Date(),
      };
      const record = existing
        ? await tx.delivery.update({ where: { id: existing.id }, data })
        : await tx.delivery.create({
            data: {
              orderId,
              branchId: order.branchId!,
              type: DeliveryType.PICKUP,
              ...data,
            },
          });
      return record;
    });

    await this.ordersService.transition(
      orderId,
      OrderStatus.DELIVERY_ASSIGNED,
      actor,
      `Pickup assigned to ${employeeId}`,
    );
    await this.auditService.record({
      actorUserId: actor.id,
      action: 'PICKUP_ASSIGNED',
      entityType: 'Delivery',
      entityId: delivery.id,
      description: 'Pickup delivery assigned',
      metadata: { orderId, employeeId },
    });
    await this.notifyEmployee(employeeId, {
      type: 'delivery.assigned',
      title: 'New pickup assignment',
      message: `Pickup assigned for order ${order.bookingCode}.`,
      data: { deliveryId: delivery.id, orderId },
    });
    await this.notifyCustomer(orderId, {
      type: 'delivery.assigned',
      title: 'Pickup assigned',
      message: `A delivery partner has been assigned to collect order ${order.bookingCode}.`,
      data: { deliveryId: delivery.id, orderId },
    });
    return delivery;
  }

  async createReturn(
    orderId: string,
    employeeId: string | undefined,
    actor: AuthenticatedUser,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException('Order is not ready for return delivery');
    }
    if (
      actor.branchIds?.length &&
      (!order.branchId || !actor.branchIds.includes(order.branchId))
    ) {
      throw new ForbiddenException('Order is outside your branch scope');
    }

    const delivery = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.delivery.findUnique({
        where: { orderId_type: { orderId, type: DeliveryType.RETURN } },
      });
      const data = {
        employeeId: employeeId ?? null,
        status: employeeId ? DeliveryStatus.ASSIGNED : DeliveryStatus.PENDING,
        assignedAt: employeeId ? new Date() : null,
        addressId: order.returnAddressId ?? order.pickupAddressId,
        scheduledAt: new Date(),
      };
      return existing
        ? tx.delivery.update({ where: { id: existing.id }, data })
        : tx.delivery.create({
            data: {
              orderId,
              branchId: order.branchId!,
              type: DeliveryType.RETURN,
              ...data,
            },
          });
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'RETURN_DELIVERY_CREATED',
      entityType: 'Delivery',
      entityId: delivery.id,
      description: 'Return delivery created',
      metadata: { orderId, employeeId },
    });
    if (employeeId) {
      await this.notifyEmployee(employeeId, {
        type: 'delivery.assigned',
        title: 'New return delivery',
        message: `Return delivery assigned for order ${order.bookingCode}.`,
        data: { deliveryId: delivery.id, orderId },
      });
    } else {
      await this.notifyRoles([UserRole.MANAGER, UserRole.ADMIN], {
        type: 'delivery.unassigned',
        title: 'Return delivery needs assignment',
        message: `Order ${order.bookingCode} is ready and has no return delivery partner.`,
        data: { deliveryId: delivery.id, orderId },
      });
    }
    await this.notifyCustomer(orderId, {
      type: 'delivery.assigned',
      title: 'Ready for return',
      message: `Your order ${order.bookingCode} is ready and a return delivery is being arranged.`,
      data: { deliveryId: delivery.id, orderId },
    });
    return delivery;
  }

  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    actor: AuthenticatedUser,
    payload: { reason?: string; notes?: string } = {},
  ) {
    if (
      [DeliveryStatus.FAILED, DeliveryStatus.CANCELLED].some((value) => value === status) &&
      !payload.reason
    ) {
      throw new BadRequestException('A reason is required for failed delivery');
    }

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');

    if (!staff(actor) && delivery.employeeId !== actor.employeeId) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }
    if (
      actor.branchIds?.length &&
      !actor.branchIds.includes(delivery.branchId)
    ) {
      throw new ForbiddenException('Delivery is outside your branch scope');
    }
    if (delivery.status === DeliveryStatus.COMPLETED) {
      throw new BadRequestException('Delivery is already completed');
    }

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status,
        notes: payload.notes,
        failureReason: payload.reason ?? null,
        startedAt:
          status === DeliveryStatus.IN_PROGRESS
            ? (delivery.startedAt ?? new Date())
            : delivery.startedAt,
        completedAt:
          [DeliveryStatus.COMPLETED, DeliveryStatus.FAILED].some((value) => value === status)
            ? new Date()
            : delivery.completedAt,
      },
    });

    if (status === DeliveryStatus.IN_PROGRESS && delivery.type === DeliveryType.PICKUP) {
      if (delivery.order.status === OrderStatus.DELIVERY_ASSIGNED) {
        await this.ordersService.transition(
          delivery.orderId,
          OrderStatus.PICKUP_IN_PROGRESS,
          actor,
          'Pickup started',
        );
      }
    }
    if (status === DeliveryStatus.COMPLETED && delivery.type === DeliveryType.PICKUP) {
      await this.ordersService.transition(
        delivery.orderId,
        OrderStatus.RECEIVED_AT_CENTER,
        actor,
        payload.notes ?? 'Shoes handed over to cleaning center',
      );
    }
    if (status === DeliveryStatus.IN_PROGRESS && delivery.type === DeliveryType.RETURN) {
      if (delivery.order.status === OrderStatus.READY_FOR_DELIVERY) {
        await this.ordersService.transition(
          delivery.orderId,
          OrderStatus.OUT_FOR_DELIVERY,
          actor,
          'Return delivery started',
        );
      }
    }
    if (status === DeliveryStatus.COMPLETED && delivery.type === DeliveryType.RETURN) {
      await this.ordersService.transition(
        delivery.orderId,
        OrderStatus.DELIVERED,
        actor,
        payload.notes ?? 'Shoes returned to customer',
      );
    }

    const statusData = {
      deliveryId,
      orderId: delivery.orderId,
      status,
    };
    if (status === DeliveryStatus.IN_PROGRESS && delivery.type === DeliveryType.PICKUP) {
      await this.notifyRoles([UserRole.MANAGER, UserRole.ADMIN], {
        type: 'delivery.status',
        title: 'Pickup started',
        message: `Pickup is in progress for order ${delivery.order.bookingCode}.`,
        data: statusData,
      });
    }
    if (status === DeliveryStatus.COMPLETED && delivery.type === DeliveryType.PICKUP) {
      await this.notifyRoles([UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN], {
        type: 'delivery.status',
        title: 'Shoes arrived at the center',
        message: `Order ${delivery.order.bookingCode} is ready to be assigned for cleaning.`,
        data: statusData,
      });
    }
    if (status === DeliveryStatus.IN_PROGRESS && delivery.type === DeliveryType.RETURN) {
      await this.notifyRoles([UserRole.MANAGER, UserRole.ADMIN], {
        type: 'delivery.status',
        title: 'Return delivery started',
        message: `Order ${delivery.order.bookingCode} is out for delivery.`,
        data: statusData,
      });
    }
    if (status === DeliveryStatus.COMPLETED && delivery.type === DeliveryType.RETURN) {
      await this.notifyRoles([UserRole.MANAGER, UserRole.ADMIN], {
        type: 'delivery.status',
        title: 'Order delivered',
        message: `Order ${delivery.order.bookingCode} was delivered to the customer.`,
        data: statusData,
      });
    }

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'DELIVERY_STATUS_CHANGE',
      entityType: 'Delivery',
      entityId: deliveryId,
      description: `${delivery.status} -> ${status}`,
      metadata: { reason: payload.reason, orderId: delivery.orderId },
    });

    return updated;
  }

  async reassignDelivery(
    deliveryId: string,
    employeeId: string,
    actor: AuthenticatedUser,
    reason: string,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    await this.employeeUser(employeeId);

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        employeeId,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
        notes: reason,
      },
    });
    await this.auditService.record({
      actorUserId: actor.id,
      action: 'DELIVERY_REASSIGNED',
      entityType: 'Delivery',
      entityId: deliveryId,
      description: 'Delivery reassigned',
      metadata: { previousEmployeeId: delivery.employeeId, employeeId, reason },
    });
    await this.notifyEmployee(employeeId, {
      type: 'delivery.assigned',
      title: 'Delivery reassigned to you',
      message: `${delivery.type} delivery reassigned for order ${delivery.orderId}.`,
      data: { deliveryId, orderId: delivery.orderId },
    });
    return updated;
  }

  async myTasks(user: AuthenticatedUser, status?: WashingStatus) {
    if (!user.employeeId) throw new ForbiddenException('Employee profile required');
    return this.prisma.washingTask.findMany({
      where: { operatorId: user.employeeId, ...(status ? { status } : {}) },
      include: {
        order: { select: { id: true, bookingCode: true, status: true } },
        orderItem: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async centerTasks(user: AuthenticatedUser, status?: WashingStatus) {
    if (!user.branchIds?.length) throw new ForbiddenException('Branch scope required');
    return this.prisma.washingTask.findMany({
      where: { branchId: { in: user.branchIds }, ...(status ? { status } : {}) },
      include: {
        order: { select: { id: true, bookingCode: true, status: true } },
        orderItem: true,
        operator: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignTask(taskId: string, operatorId: string, actor: AuthenticatedUser) {
    const task = await this.prisma.washingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Washing task not found');
    await this.employeeUser(operatorId);

    const updated = await this.prisma.washingTask.update({
      where: { id: taskId },
      data: { operatorId, status: WashingStatus.ASSIGNED },
    });
    await this.auditService.record({
      actorUserId: actor.id,
      action: 'WASHING_TASK_ASSIGNED',
      entityType: 'WashingTask',
      entityId: taskId,
      description: 'Cleaning task assigned',
      metadata: { operatorId, orderId: task.orderId },
    });
    await this.notifyEmployee(operatorId, {
      type: 'washing.assigned',
      title: 'New cleaning task',
      message: `A cleaning task was assigned for order ${task.orderId}.`,
      data: { taskId, orderId: task.orderId },
    });
    return updated;
  }

  async updateTaskStatus(
    taskId: string,
    status: WashingStatus,
    actor: AuthenticatedUser,
    notes?: string,
  ) {
    const task = await this.prisma.washingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Washing task not found');
    if (!staff(actor) && task.operatorId !== actor.employeeId) {
      throw new ForbiddenException('This cleaning task is not assigned to you');
    }
    if (task.status === WashingStatus.COMPLETED) {
      throw new BadRequestException('Task is already completed');
    }

    const updated = await this.prisma.washingTask.update({
      where: { id: taskId },
      data: {
        status,
        notes: notes ?? task.notes,
        startedAt:
          status === WashingStatus.IN_PROGRESS
            ? (task.startedAt ?? new Date())
            : task.startedAt,
        completedAt:
          status === WashingStatus.COMPLETED ? new Date() : task.completedAt,
      },
    });

    if (status === WashingStatus.IN_PROGRESS) {
      const order = await this.prisma.order.findUnique({
        where: { id: task.orderId },
        select: { status: true, bookingCode: true },
      });
      if (order?.status === OrderStatus.RECEIVED_AT_CENTER) {
        await this.ordersService.transition(
          task.orderId,
          OrderStatus.WASHING_IN_PROGRESS,
          actor,
          'Cleaning started',
        );
      }
      await this.notifyRoles([UserRole.MANAGER, UserRole.ADMIN], {
        type: 'washing.status',
        title: 'Cleaning started',
        message: `Cleaning started for a task on order ${order?.bookingCode ?? task.orderId}.`,
        data: { taskId, orderId: task.orderId, status },
      });
    }
    if (status === WashingStatus.COMPLETED) {
      await this.notifyRoles([UserRole.MANAGER, UserRole.ADMIN], {
        type: 'washing.status',
        title: 'Cleaning task completed',
        message: `A cleaning task for order ${task.orderId} is complete.`,
        data: { taskId, orderId: task.orderId, status },
      });
    }

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'WASHING_TASK_STATUS',
      entityType: 'WashingTask',
      entityId: taskId,
      description: `${task.status} -> ${status}`,
      metadata: { orderId: task.orderId },
    });
    return updated;
  }

  async markReady(orderId: string, actor: AuthenticatedUser) {
    const tasks = await this.prisma.washingTask.findMany({
      where: { orderId },
      select: { status: true },
    });
    if (!tasks.length || tasks.some((t) => t.status !== WashingStatus.COMPLETED)) {
      throw new BadRequestException('All cleaning tasks must be completed first');
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.WASHING_COMPLETED) {
      await this.ordersService.transition(
        orderId,
        OrderStatus.WASHING_COMPLETED,
        actor,
        'Cleaning completed',
      );
    }
    await this.ordersService.transition(
      orderId,
      OrderStatus.READY_FOR_DELIVERY,
      actor,
      'Shoes ready for return delivery',
    );

    const pickup = await this.prisma.delivery.findUnique({
      where: { orderId_type: { orderId, type: DeliveryType.PICKUP } },
    });
    await this.createReturn(orderId, pickup?.employeeId ?? undefined, actor);
    await this.notifyRoles([UserRole.MANAGER, UserRole.ADMIN], {
      type: 'washing.ready',
      title: 'Cleaning complete',
      message: `Order ${order.bookingCode} is cleaned and ready for return delivery.`,
      data: { orderId },
    });
    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  async inspections(orderItemId: string) {
    return this.prisma.shoeInspection.findMany({
      where: { orderItemId },
      include: {
        inspector: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async upsertInspection(
    orderItemId: string,
    actor: AuthenticatedUser,
    input: {
      conditionBefore?: string | null;
      conditionAfter?: string | null;
      notes?: string | null;
      beforePhotos?: string[];
      afterPhotos?: string[];
    },
  ) {
    if (!actor.employeeId) throw new ForbiddenException('Employee profile required');
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: { select: { id: true, status: true } } },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (
      ![OrderStatus.RECEIVED_AT_CENTER, OrderStatus.WASHING_IN_PROGRESS, OrderStatus.WASHING_COMPLETED, OrderStatus.READY_FOR_DELIVERY].some(
        (value) => value === item.order.status,
      )
    ) {
      throw new BadRequestException('Order has not reached the cleaning center');
    }

    const inspection = await this.prisma.shoeInspection.upsert({
      where: { orderItemId },
      create: {
        orderItemId,
        inspectorId: actor.employeeId,
        conditionBefore: input.conditionBefore,
        conditionAfter: input.conditionAfter,
        notes: input.notes,
        beforePhotos: input.beforePhotos ?? [],
        afterPhotos: input.afterPhotos ?? [],
      },
      update: {
        inspectorId: actor.employeeId,
        conditionBefore: input.conditionBefore,
        conditionAfter: input.conditionAfter,
        notes: input.notes,
        beforePhotos: input.beforePhotos,
        afterPhotos: input.afterPhotos,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'SHOE_INSPECTION_SAVED',
      entityType: 'ShoeInspection',
      entityId: inspection.id,
      description: 'Shoe inspection recorded',
      metadata: { orderItemId, orderId: item.order.id },
    });
    return inspection;
  }
}
