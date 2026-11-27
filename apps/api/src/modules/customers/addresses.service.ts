import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

export interface AddressInput {
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  addressLine: string;
  city: string;
  subCity?: string | null;
  woreda?: string | null;
  houseNumber?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async requireCustomerId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { customer: { select: { id: true } } },
    });
    if (!user?.customer) {
      throw new ForbiddenException('Customer profile is required');
    }
    return user.customer.id;
  }

  async findMine(userId: string) {
    const customerId = await this.requireCustomerId(userId);
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, input: AddressInput) {
    const customerId = await this.requireCustomerId(userId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }
      const address = await tx.address.create({
        data: {
          ...input,
          customerId,
          isDefault: input.isDefault ?? false,
        },
      });
      await this.auditService.record({
        actorUserId: userId,
        action: 'ADDRESS_CREATE',
        entityType: 'Address',
        entityId: address.id,
        description: 'Customer address added',
      });
      return address;
    });
  }

  async update(userId: string, id: string, input: Partial<AddressInput>) {
    const customerId = await this.requireCustomerId(userId);
    const address = await this.prisma.address.findFirst({
      where: { id, customerId },
    });
    if (!address) throw new NotFoundException('Address not found');

    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }
      const updated = await tx.address.update({
        where: { id },
        data: input,
      });
      await this.auditService.record({
        actorUserId: userId,
        action: 'ADDRESS_UPDATE',
        entityType: 'Address',
        entityId: id,
        description: 'Customer address updated',
      });
      return updated;
    });
  }

  async remove(userId: string, id: string) {
    const customerId = await this.requireCustomerId(userId);
    const address = await this.prisma.address.findFirst({
      where: { id, customerId },
      include: { _count: { select: { pickupOrders: true, returnOrders: true } } },
    });
    if (!address) throw new NotFoundException('Address not found');
    if (address._count.pickupOrders || address._count.returnOrders) {
      throw new ForbiddenException('Address is referenced by an existing order');
    }
    await this.prisma.address.delete({ where: { id } });
    await this.auditService.record({
      actorUserId: userId,
      action: 'ADDRESS_DELETE',
      entityType: 'Address',
      entityId: id,
      description: 'Customer address removed',
    });
    return { success: true };
  }
}
