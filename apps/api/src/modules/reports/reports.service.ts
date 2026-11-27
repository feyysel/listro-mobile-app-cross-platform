import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
  WashingStatus,
} from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private whereFor(user: AuthenticatedUser) {
    if (user.branchIds?.length) return { branchId: { in: user.branchIds } };
    return {};
  }

  async dashboard(user: AuthenticatedUser) {
    const where = this.whereFor(user);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (user.role === UserRole.OPERATOR) {
      const tasks = await this.prisma.washingTask.findMany({
        where: { operatorId: user.employeeId ?? '' },
        select: {
          status: true,
          createdAt: true,
          order: { select: { status: true, placedAt: true } },
        },
      });
      const orderCounts: Record<string, number> = {};
      const washingCounts: Record<string, number> = {};
      let todayOrders = 0;
      let overdueTasks = 0;
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;

      for (const task of tasks) {
        washingCounts[task.status] = (washingCounts[task.status] ?? 0) + 1;
        orderCounts[task.order.status] = (orderCounts[task.order.status] ?? 0) + 1;
        if (task.order.placedAt >= todayStart) todayOrders += 1;
        if (task.status !== WashingStatus.COMPLETED && task.createdAt.getTime() < cutoff) {
          overdueTasks += 1;
        }
      }

      return {
        orderCounts,
        todayOrders,
        activePickups: 0,
        activeReturns: 0,
        washingCounts,
        overdueTasks,
        collectedRevenue: 0,
        completedPayments: 0,
        failedDeliveries: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const [ordersByStatus, todayOrders, activePickups, activeReturns, tasksByStatus, overdueTasks, revenue, failedDeliveries] =
      await this.prisma.$transaction([
        this.prisma.order.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.order.count({
          where: { ...where, placedAt: { gte: todayStart } },
        }),
        this.prisma.delivery.count({
          where: {
            ...where,
            type: 'PICKUP',
            status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.IN_PROGRESS] },
          },
        }),
        this.prisma.delivery.count({
          where: {
            ...where,
            type: 'RETURN',
            status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.IN_PROGRESS] },
          },
        }),
        this.prisma.washingTask.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.washingTask.count({
          where: {
            ...where,
            status: { not: WashingStatus.COMPLETED },
            createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.COMPLETED,
            order: where,
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.prisma.delivery.count({
          where: { ...where, status: DeliveryStatus.FAILED },
        }),
      ]);

    return {
      orderCounts: Object.fromEntries(
        ordersByStatus.map((row) => [row.status, row._count._all]),
      ) as Partial<Record<OrderStatus, number>>,
      todayOrders,
      activePickups,
      activeReturns,
      washingCounts: Object.fromEntries(
        tasksByStatus.map((row) => [row.status, row._count._all]),
      ) as Partial<Record<WashingStatus, number>>,
      overdueTasks,
      collectedRevenue: Number(revenue._sum.amount ?? 0),
      completedPayments: revenue._count._all,
      failedDeliveries,
      generatedAt: new Date().toISOString(),
    };
  }

  async revenue(from?: Date, to?: Date) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        ...(from || to
          ? {
              paidAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: { amount: true, method: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    const byMethod = payments.reduce<Record<string, number>>((acc, payment) => {
      acc[payment.method] = (acc[payment.method] ?? 0) + Number(payment.amount);
      return acc;
    }, {});

    const byDay = payments.reduce<Record<string, number>>((acc, payment) => {
      const key = payment.paidAt?.toISOString().slice(0, 10) ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + Number(payment.amount);
      return acc;
    }, {});

    return {
      total: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      count: payments.length,
      byMethod,
      byDay,
    };
  }

  async popularServices() {
    const groups = await this.prisma.orderItem.groupBy({
      by: ['serviceName'],
      _count: { _all: true },
      _sum: { totalPrice: true },
      orderBy: { _count: { serviceName: 'desc' } },
      take: 10,
    });
    return groups.map((row) => ({
      name: row.serviceName,
      orders: row._count._all,
      revenue: Number(row._sum.totalPrice ?? 0),
    }));
  }

  async employeeWorkload() {
    const deliveries = await this.prisma.delivery.groupBy({
      by: ['employeeId'],
      _count: { _all: true },
      where: { status: DeliveryStatus.COMPLETED, employeeId: { not: null } },
    });
    const tasks = await this.prisma.washingTask.groupBy({
      by: ['operatorId'],
      _count: { _all: true },
      where: { status: WashingStatus.COMPLETED, operatorId: { not: null } },
    });
    const ids = [
      ...new Set([
        ...deliveries.map((row) => row.employeeId).filter(Boolean),
        ...tasks.map((row) => row.operatorId).filter(Boolean),
      ]),
    ] as string[];

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: ids } },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });

    return employees.map((employee) => ({
      id: employee.id,
      name: `${employee.user.firstName} ${employee.user.lastName ?? ''}`.trim(),
      role: employee.user.role,
      deliveries: deliveries.find((row) => row.employeeId === employee.id)?._count._all ?? 0,
      cleaningTasks: tasks.find((row) => row.operatorId === employee.id)?._count._all ?? 0,
    }));
  }
}
