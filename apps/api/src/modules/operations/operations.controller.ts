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
import {
  DeliveryStatus,
  UserRole,
  WashingStatus,
} from '../../generated/prisma/client.js';
import { OperationsService } from './operations.service.js';

const deliveryStatusSchema = z.object({
  status: z.nativeEnum(DeliveryStatus),
  reason: z.string().trim().min(3).max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const assignSchema = z.object({
  employeeId: z.string().min(1),
  reason: z.string().trim().min(3).max(500).optional(),
});

const taskStatusSchema = z.object({
  status: z.nativeEnum(WashingStatus),
  notes: z.string().trim().max(1000).optional(),
});

const inspectionSchema = z.object({
  conditionBefore: z.string().trim().max(1000).nullish(),
  conditionAfter: z.string().trim().max(1000).nullish(),
  notes: z.string().trim().max(1000).nullish(),
  beforePhotos: z.array(z.string()).max(10).optional(),
  afterPhotos: z.array(z.string()).max(10).optional(),
});

@ApiTags('Operations')
@Controller()
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('deliveries/my')
  @Roles(UserRole.DELIVERY, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List deliveries assigned to the current employee' })
  myDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: z.object({ status: z.nativeEnum(DeliveryStatus).optional() }) })
    query: { status?: DeliveryStatus },
  ) {
    return this.operationsService.myDeliveries(user, query.status);
  }

  @Get('orders/:id/deliveries')
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.DELIVERY)
  @ApiOperation({ summary: 'List pickup and return deliveries for an order' })
  orderDeliveries(@Param('id') id: string) {
    return this.operationsService.orderDeliveries(id);
  }

  @Post('orders/:id/deliveries/pickup')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign a delivery person to a pickup' })
  assignPickup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: assignSchema }) body: z.infer<typeof assignSchema>,
  ) {
    return this.operationsService.assignPickup(id, body.employeeId, user);
  }

  @Post('orders/:id/deliveries/return')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create or assign a return delivery' })
  createReturn(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: assignSchema.partial() })
    body: Partial<z.infer<typeof assignSchema>>,
  ) {
    return this.operationsService.createReturn(id, body.employeeId, user);
  }

  @Patch('deliveries/:id/status')
  @Roles(UserRole.DELIVERY, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update pickup or return delivery progress' })
  updateDeliveryStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: deliveryStatusSchema })
    body: z.infer<typeof deliveryStatusSchema>,
  ) {
    return this.operationsService.updateDeliveryStatus(id, body.status, user, {
      reason: body.reason,
      notes: body.notes,
    });
  }

  @Post('deliveries/:id/reassign')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reassign a delivery with recorded history' })
  reassign(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: assignSchema }) body: z.infer<typeof assignSchema>,
  ) {
    return this.operationsService.reassignDelivery(
      id,
      body.employeeId,
      user,
      body.reason ?? 'Delivery reassigned by manager',
    );
  }

  @Get('washing-tasks/my')
  @Roles(UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List cleaning tasks assigned to the current operator' })
  myTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: z.object({ status: z.nativeEnum(WashingStatus).optional() }) })
    query: { status?: WashingStatus },
  ) {
    return this.operationsService.myTasks(user, query.status);
  }

  @Get('washing-tasks/center')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List cleaning tasks across the manager branch scope' })
  centerTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: z.object({ status: z.nativeEnum(WashingStatus).optional() }) })
    query: { status?: WashingStatus },
  ) {
    return this.operationsService.centerTasks(user, query.status);
  }

  @Post('washing-tasks/:id/assign')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign a cleaning task to an operator' })
  assignTask(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: z.object({ operatorId: z.string().min(1) }) })
    body: { operatorId: string },
  ) {
    return this.operationsService.assignTask(id, body.operatorId, user);
  }

  @Patch('washing-tasks/:id/status')
  @Roles(UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Start, update, or complete a cleaning task' })
  updateTaskStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: taskStatusSchema })
    body: z.infer<typeof taskStatusSchema>,
  ) {
    return this.operationsService.updateTaskStatus(
      id,
      body.status,
      user,
      body.notes,
    );
  }

  @Post('orders/:id/ready')
  @Roles(UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark an order ready only after all tasks complete' })
  markReady(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.operationsService.markReady(id, user);
  }

  @Post('order-items/:id/inspections')
  @Roles(UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Record before and after shoe condition inspections' })
  upsertInspection(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: inspectionSchema })
    body: z.infer<typeof inspectionSchema>,
  ) {
    return this.operationsService.upsertInspection(id, user, body);
  }

  @Get('order-items/:id/inspections')
  @ApiOperation({ summary: 'Get inspection records for an order item' })
  inspections(@Param('id') id: string) {
    return this.operationsService.inspections(id);
  }
}
