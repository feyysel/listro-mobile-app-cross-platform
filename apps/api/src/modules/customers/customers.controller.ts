import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { UserRole } from '../../generated/prisma/client.js';
import { CustomersService } from './customers.service.js';

const profileSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().max(80).nullish(),
  phone: z.string().trim().min(9).max(20).nullish(),
  notes: z.string().trim().max(1000).nullish(),
  dateOfBirth: z.iso.date().nullish(),
});

@ApiTags('Customers')
@Roles(UserRole.CUSTOMER, UserRole.ADMIN)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List customers with lifetime value and active orders' })
  findAll(@Query({ schema: z.object({ search: z.string().trim().optional() }) }) query: { search?: string }) {
    return this.customersService.findAll(query.search);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current customer profile' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.me(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update permitted customer profile fields' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: profileSchema }) body: z.infer<typeof profileSchema>,
  ) {
    return this.customersService.update(user.id, body);
  }
}
