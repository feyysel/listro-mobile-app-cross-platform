import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/client.js';
import { hashPassword, verifyPassword } from '../../common/password.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  RefreshDto,
} from './auth.schemas.js';
import { TokensService } from './tokens.service.js';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyHash = hashPassword('listro-dummy-password');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, context: RequestContext = {}) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email is already registered');

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        customer: { create: {} },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        customer: { select: { id: true } },
      },
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'AUTH_REGISTER',
      entityType: 'User',
      entityId: user.id,
      description: 'Customer account created',
      ...context,
    });

    const tokens = await this.tokensService.issue(user);
    return { user, ...tokens };
  }

  async login(dto: LoginDto, context: RequestContext = {}) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        customer: { select: { id: true } },
        employee: {
          select: {
            id: true,
            branchMemberships: { select: { branchId: true } },
          },
        },
      },
    });

    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditService.record({
      actorUserId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
      description: 'User signed in',
      ...context,
    });

    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      customerId: user.customer?.id ?? null,
      employeeId: user.employee?.id ?? null,
      branchIds:
        user.employee?.branchMemberships.map((b: { branchId: string }) => b.branchId) ?? [],
    };

    return { user: safeUser, ...(await this.tokensService.issue(safeUser)) };
  }

  async refresh(dto: RefreshDto) {
    return this.tokensService.rotate(dto.refreshToken);
  }

  async logout(refreshToken: string, userId: string) {
    await this.tokensService.revokeFamily(refreshToken);
    await this.auditService.record({
      actorUserId: userId,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: userId,
      description: 'User signed out',
    });
    return { success: true };
  }

  async forgotPassword(dto: EmailDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(
          `Password reset token for development use: ${token}`,
        );
      }
    }

    return {
      message: 'If an account exists for this email, a reset link has been issued.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, context: RequestContext = {}) {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(dto.password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.auditService.record({
      actorUserId: stored.userId,
      action: 'AUTH_PASSWORD_RESET',
      entityType: 'User',
      entityId: stored.userId,
      description: 'Password reset completed',
      ...context,
    });

    return { success: true };
  }

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
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        customer: { select: { id: true, notes: true } },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            status: true,
            branchMemberships: {
              select: {
                branchId: true,
                branch: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
