import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

export interface BranchInput {
  name: string;
  code: string;
  address: string;
  city: string;
  subCity?: string | null;
  woreda?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  latitude?: number | null;
  longitude?: number | null;
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.branch.findMany({
      include: { _count: { select: { orders: true, employees: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        branchServices: { include: { service: true } },
        employees: { include: { employee: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } } } } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(input: BranchInput, actorUserId: string) {
    const existing = await this.prisma.branch.findUnique({
      where: { code: input.code },
    });
    if (existing) throw new ConflictException('Branch code already exists');

    const branch = await this.prisma.branch.create({ data: { ...input } });
    await this.auditService.record({
      actorUserId,
      action: 'BRANCH_CREATE',
      entityType: 'Branch',
      entityId: branch.id,
      description: 'Branch created',
      metadata: { code: branch.code },
    });
    return branch;
  }

  async update(id: string, input: Partial<BranchInput>, actorUserId: string) {
    const branch = await this.prisma.branch.update({
      where: { id },
      data: input,
    });
    await this.auditService.record({
      actorUserId,
      action: 'BRANCH_UPDATE',
      entityType: 'Branch',
      entityId: id,
      description: 'Branch updated',
    });
    return branch;
  }
}
