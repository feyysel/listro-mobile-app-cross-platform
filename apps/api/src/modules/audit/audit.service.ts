import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        description: entry.description ?? null,
        metadata: (entry.metadata ?? {}) as object,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  async findAll(options: {
    search?: string;
    action?: string;
    entityType?: string;
    page: number;
    limit: number;
  }) {
    const where = {
      ...(options.search
        ? {
            OR: [
              { action: { contains: options.search, mode: 'insensitive' as const } },
              { description: { contains: options.search, mode: 'insensitive' as const } },
              { entityType: { contains: options.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(options.action ? { action: options.action } : {}),
      ...(options.entityType ? { entityType: options.entityType } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: { page: options.page, limit: options.limit, total, pages: Math.ceil(total / options.limit) },
    };
  }
}
