import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { OrderStatus, UserRole } from '../../generated/prisma/client.js';
import { OrdersService } from './orders.service.js';

const orderItemSchema = z.object({
  serviceId: z.string().min(1),
  shoeCategory: z.string().trim().min(2).max(80),
  shoeBrand: z.string().trim().max(80).nullish(),
  shoeModel: z.string().trim().max(80).nullish(),
  shoeColor: z.string().trim().max(60).nullish(),
  conditionNotes: z.string().trim().max(1000).nullish(),
  quantity: z.number().int().min(1).max(20).default(1),
});

const createOrderSchema = z.object({
  pickupAddressId: z.string().min(1),
  returnAddressId: z.string().min(1).nullish(),
  branchId: z.string().min(1).nullish(),
  customerNotes: z.string().trim().max(1000).nullish(),
  preferredPickupAt: z.iso.datetime().nullish(),
  items: z.array(orderItemSchema).min(1).max(20),
});

const booleanQuery = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const listSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  mine: z.coerce.boolean().default(false),
  liveOnly: booleanQuery.optional().default(false),
  includePayments: booleanQuery.optional().default(false),
});

const decisionSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an order with priced, immutable item snapshots' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createOrderSchema })
    body: z.infer<typeof createOrderSchema>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(user, body, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List orders visible to the current role and branch' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: listSchema }) query: z.infer<typeof listSchema>,
  ) {
    return this.ordersService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get the full order workflow record' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOne(user, id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get the immutable status-change history' })
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.history(user, id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm a placed order' })
  confirm(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: decisionSchema.partial() })
    body: Partial<z.infer<typeof decisionSchema>>,
  ) {
    return this.ordersService.confirm(id, user, body.reason);
  }

  @Post(':id/reject')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject an order with a required reason' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: decisionSchema }) body: z.infer<typeof decisionSchema>,
  ) {
    return this.ordersService.reject(id, user, body.reason);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order when policy allows it' })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: decisionSchema.partial() })
    body: Partial<z.infer<typeof decisionSchema>>,
  ) {
    return this.ordersService.cancel(id, user, body.reason);
  }
}
