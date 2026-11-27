import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { UserRole } from '../../generated/prisma/client.js';
import { ReportsService } from './reports.service.js';

const dateRangeSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Role-appropriate operational dashboard metrics' })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.dashboard(user);
  }

  @Get('revenue')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Revenue by payment method and day' })
  revenue(
    @Query({ schema: dateRangeSchema }) query: z.infer<typeof dateRangeSchema>,
  ) {
    return this.reportsService.revenue(
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('services')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Most popular services' })
  services() {
    return this.reportsService.popularServices();
  }

  @Get('workload')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Completed deliveries and cleaning tasks by employee' })
  workload() {
    return this.reportsService.employeeWorkload();
  }
}
