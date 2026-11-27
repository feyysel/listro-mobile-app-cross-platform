import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { UserRole } from '../generated/prisma/client.js';

export const PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: UserRole;
  status: string;
  employeeId?: string | null;
  customerId?: string | null;
  branchIds?: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
    }>();
    return request.user;
  },
);
