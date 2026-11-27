import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators.js';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

function durationToMs(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(user: AuthenticatedUser | { id: string; email: string; role: string }) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn:
          Math.floor(
            durationToMs(this.configService.get<string>('JWT_ACCESS_TTL', '15m')) / 1000,
          ),
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const ttl = this.configService.get<string>('JWT_REFRESH_TTL', '7d');
    const familyId = randomBytes(16).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + durationToMs(ttl)),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: durationToMs(
        this.configService.get<string>('JWT_ACCESS_TTL', '15m'),
      ) / 1000,
    };
  }

  async rotate(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token was already used');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const nextRefreshToken = randomBytes(48).toString('hex');
    await this.prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(nextRefreshToken),
          familyId: stored.familyId,
          expiresAt: new Date(
            Date.now() +
              durationToMs(
                this.configService.get<string>('JWT_REFRESH_TTL', '7d'),
              ),
          ),
        },
      });

      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedById: next.id },
      });

      return next;
    });

    const refreshedAccess = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn:
          Math.floor(
            durationToMs(this.configService.get<string>('JWT_ACCESS_TTL', '15m')) / 1000,
          ),
      },
    );

    return {
      accessToken: refreshedAccess,
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn:
        durationToMs(
          this.configService.get<string>('JWT_ACCESS_TTL', '15m'),
        ) / 1000,
    };
  }

  async revokeFamily(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  hash(token: string) {
    return hashToken(token);
  }
}
