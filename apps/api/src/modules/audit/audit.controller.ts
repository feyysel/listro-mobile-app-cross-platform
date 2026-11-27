import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../../common/decorators.js';
import { UserRole } from '../../generated/prisma/client.js';
import { AuditService } from './audit.service.js';

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
});

@ApiTags('Audit logs')
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Search protected audit history' })
  findAll(@Query({ schema: auditQuerySchema }) query: z.infer<typeof auditQuerySchema>) {
    return this.auditService.findAll(query);
  }
}
