import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client.js';
import { hashPassword } from '../../common/password.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

export interface EmployeeInput {
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  password: string;
  role: 'DELIVERY' | 'OPERATOR' | 'MANAGER' | 'ADMIN';
  employeeCode: string;
  branchIds?: string[];
  notes?: string | null;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(options: {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    branchId?: string;
    page: number;
    limit: number;
  }) {
    const where = {
      ...(options.role ? { user: { role: options.role } } : {}),
      ...(options.status ? { user: { status: options.status } } : {}),
      ...(options.search
        ? {
            user: {
              OR: [
                { firstName: { contains: options.search, mode: 'insensitive' as const } },
                { lastName: { contains: options.search, mode: 'insensitive' as const } },
                { email: { contains: options.search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
      ...(options.branchId
        ? { branchMemberships: { some: { branchId: options.branchId } } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              status: true,
              lastLoginAt: true,
            },
          },
          branchMemberships: { include: { branch: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit),
      },
    };
  }

  async create(input: EmployeeInput, actorUserId: string) {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Email is already registered');

    const existingCode = await this.prisma.employee.findUnique({
      where: { employeeCode: input.employeeCode },
    });
    if (existingCode) throw new ConflictException('Employee code already exists');

    const passwordHash = await hashPassword(input.password);
    const employee = await this.prisma.employee.create({
      data: {
        employeeCode: input.employeeCode,
        notes: input.notes,
        status: EmployeeStatus.ACTIVE,
        user: {
          create: {
            firstName: input.firstName,
            lastName: input.lastName,
            email,
            phone: input.phone,
            passwordHash,
            role: input.role as UserRole,
            status: UserStatus.ACTIVE,
          },
        },
        branchMemberships: {
          create: (input.branchIds ?? []).map((branchId) => ({ branchId })),
        },
      },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    await this.auditService.record({
      actorUserId,
      action: 'EMPLOYEE_CREATE',
      entityType: 'Employee',
      entityId: employee.id,
      description: 'Employee account created',
      metadata: { role: input.role, email },
    });
    return employee;
  }

  async update(
    id: string,
    input: {
      status?: EmployeeStatus;
      userStatus?: UserStatus;
      role?: UserRole;
      branchIds?: string[];
      notes?: string | null;
    },
    actorUserId: string,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: { select: { id: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.branchIds) {
        await tx.branchEmployee.deleteMany({ where: { employeeId: id } });
        await tx.branchEmployee.createMany({
          data: input.branchIds.map((branchId) => ({ employeeId: id, branchId })),
        });
      }

      return tx.employee.update({
        where: { id },
        data: {
          status: input.status,
          notes: input.notes,
          user: {
            update: {
              status: input.userStatus,
              role: input.role,
            },
          },
        },
        include: { user: { select: { id: true, firstName: true, email: true, role: true, status: true } } },
      });
    });

    await this.auditService.record({
      actorUserId,
      action: 'EMPLOYEE_UPDATE',
      entityType: 'Employee',
      entityId: id,
      description: 'Employee account updated',
      metadata: input as Record<string, unknown>,
    });
    return updated;
  }
}
