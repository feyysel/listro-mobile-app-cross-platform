import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../decorators.js';
import { PUBLIC_KEY, ROLES_KEY } from '../decorators.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
    }>().user;
    if (!user) throw new ForbiddenException('Access denied');

    if (user.role === UserRole.ADMIN || roles.includes(user.role)) return true;
    throw new ForbiddenException('Your role cannot perform this action');
  }
}
