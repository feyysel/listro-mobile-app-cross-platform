import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { UserRole } from '../../generated/prisma/client.js';
import { ServicesService } from './services.service.js';

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional(),
  estimatedDurationMinutes: z.number().int().positive().max(10080).nullish(),
  price: z.number().positive().max(1000000),
});

const updateSchema = createSchema.partial();
const listSchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
  branchId: z.string().optional(),
});

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Browse available cleaning services and prices' })
  findAll(
    @Query({ schema: listSchema }) query: z.infer<typeof listSchema>,
  ) {
    return this.servicesService.findAll(query.includeInactive, query.branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one cleaning service' })
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a cleaning service' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createSchema }) body: z.infer<typeof createSchema>,
  ) {
    return this.servicesService.create(body, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a cleaning service, price, or availability' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: updateSchema }) body: Partial<z.infer<typeof createSchema>>,
  ) {
    return this.servicesService.update(id, body, user.id);
  }
}
