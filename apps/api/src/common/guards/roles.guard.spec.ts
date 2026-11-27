import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext, Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../generated/prisma/client.js';
import { RolesGuard } from './roles.guard.js';

function context(user?: { role: UserRole }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows public routes without a user', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows admins regardless of required roles', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce([UserRole.MANAGER]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('rejects users without the required role', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce([UserRole.MANAGER]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context({ role: UserRole.CUSTOMER }))).toThrow(
      ForbiddenException,
    );
  });
});
