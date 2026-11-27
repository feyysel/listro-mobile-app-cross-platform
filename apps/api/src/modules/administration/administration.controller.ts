import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { EmployeeStatus, UserRole, UserStatus } from '../../generated/prisma/client.js';
import { BranchesService } from './branches.service.js';
import { EmployeesService } from './employees.service.js';

const branchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40),
  address: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(80),
  subCity: z.string().trim().max(80).nullish(),
  woreda: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(30).nullish(),
  email: z.email().max(180).nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
});

@ApiTags('Branches')
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: branchSchema }) body: z.infer<typeof branchSchema>,
  ) {
    return this.branchesService.create(body, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: branchSchema.partial() }) body: Partial<z.infer<typeof branchSchema>>,
  ) {
    return this.branchesService.update(id, body, user.id);
  }
}

const employeeSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).nullish(),
  email: z.email().max(180),
  phone: z.string().trim().min(9).max(20).nullish(),
  password: z.string().min(8).max(128),
  role: z.enum(['DELIVERY', 'OPERATOR', 'MANAGER', 'ADMIN']),
  employeeCode: z.string().trim().min(2).max(40),
  branchIds: z.array(z.string()).optional(),
  notes: z.string().trim().max(1000).nullish(),
});

const employeeUpdateSchema = z.object({
  status: z.nativeEnum(EmployeeStatus).optional(),
  userStatus: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
  branchIds: z.array(z.string()).optional(),
  notes: z.string().trim().max(1000).nullish(),
});

const employeeListSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().trim().optional(),
  branchId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

@ApiTags('Employees')
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'Search employees with pagination and filters' })
  findAll(
    @Query({ schema: employeeListSchema })
    query: z.infer<typeof employeeListSchema>,
  ) {
    return this.employeesService.findAll(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an employee account' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: employeeSchema }) body: z.infer<typeof employeeSchema>,
  ) {
    return this.employeesService.create(body, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update employee status, role, or branch scope' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: employeeUpdateSchema })
    body: z.infer<typeof employeeUpdateSchema>,
  ) {
    return this.employeesService.update(id, body, user.id);
  }
}
