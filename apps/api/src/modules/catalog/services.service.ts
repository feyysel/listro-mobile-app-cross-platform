import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface ServiceInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  estimatedDurationMinutes?: number | null;
  price?: number;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(includeInactive = false, branchId?: string) {
    const branch =
      (branchId
        ? await this.prisma.branch.findUnique({ where: { id: branchId } })
        : await this.prisma.branch.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
          })) ?? null;

    return this.prisma.service.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        branchServices: {
          where: branch
            ? { branchId: branch.id, ...(includeInactive ? {} : { isActive: true }) }
            : { isActive: true },
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { branchServices: { include: { branch: true } } },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(input: ServiceInput, actorUserId: string) {
    const branch =
      input.price !== undefined
        ? await this.prisma.branch.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
          })
        : null;

    const service = await this.prisma.service.create({
      data: {
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        ...(branch && input.price !== undefined
          ? {
              branchServices: {
                create: { branchId: branch.id, price: input.price },
              },
            }
          : {}),
      },
    });

    await this.auditService.record({
      actorUserId,
      action: 'SERVICE_CREATE',
      entityType: 'Service',
      entityId: service.id,
      description: 'Cleaning service created',
      metadata: { name: service.name },
    });
    return service;
  }

  async update(id: string, input: Partial<ServiceInput>, actorUserId: string) {
    const existing = await this.findOne(id);
    const service = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          estimatedDurationMinutes: input.estimatedDurationMinutes,
        },
      });

      if (input.price !== undefined) {
        const primaryBranch = await tx.branch.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });
        if (!primaryBranch) {
          throw new ConflictException('No active branch available for pricing');
        }
        await tx.branchService.upsert({
          where: {
            branchId_serviceId: {
              branchId: primaryBranch.id,
              serviceId: id,
            },
          },
          create: { branchId: primaryBranch.id, serviceId: id, price: input.price },
          update: { price: input.price },
        });
      }
      return updated;
    });

    await this.auditService.record({
      actorUserId,
      action: 'SERVICE_UPDATE',
      entityType: 'Service',
      entityId: id,
      description: 'Cleaning service updated',
      metadata: { previousName: existing.name },
    });
    return service;
  }
}
