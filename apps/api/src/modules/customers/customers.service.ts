import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        customer: {
          include: {
            _count: { select: { orders: true, addresses: true, shoes: true } },
          },
        },
      },
    });
    if (!user?.customer) throw new NotFoundException('Customer profile not found');
    return user;
  }

  async findAll(search?: string) {
    const customers = await this.prisma.customer.findMany({
      where: search
        ? {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {},
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        },
        orders: { select: { totalAmount: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return customers.map((customer) => ({
      ...customer.user,
      id: customer.id,
      orders: customer.orders.length,
      lifetimeValue: customer.orders.reduce(
        (sum, order) => sum + Number(order.totalAmount),
        0,
      ),
      activeOrders: customer.orders.filter((order) =>
        !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(order.status),
      ).length,
    }));
  }

  async update(
    userId: string,
    input: {
      firstName?: string;
      lastName?: string | null;
      phone?: string | null;
      notes?: string | null;
      dateOfBirth?: string | null;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { customer: { select: { id: true } } },
    });
    if (!user?.customer) throw new NotFoundException('Customer profile not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const account = await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      });
      await tx.customer.update({
        where: { id: user.customer!.id },
        data: {
          notes: input.notes,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : input.dateOfBirth === null ? null : undefined,
        },
      });
      return account;
    });

    await this.auditService.record({
      actorUserId: userId,
      action: 'CUSTOMER_PROFILE_UPDATE',
      entityType: 'Customer',
      entityId: user.customer.id,
      description: 'Customer profile updated',
    });

    return updated;
  }
}
