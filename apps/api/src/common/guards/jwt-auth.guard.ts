import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PUBLIC_KEY } from '../decorators.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: unknown;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = header.slice(7);
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    request.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      employeeId: user.employee?.id ?? null,
      customerId: user.customer?.id ?? null,
      branchIds:
        user.employee?.branchMemberships.map((b: { branchId: string }) => b.branchId) ?? [],
    };

    return true;
  }
}
