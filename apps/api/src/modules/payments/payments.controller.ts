import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import {
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import { PaymentsService } from './payments.service.js';

const paymentSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.nativeEnum(PaymentMethod),
  kind: z.nativeEnum(PaymentKind).default(PaymentKind.DEPOSIT),
  status: z.enum(['PENDING', 'COMPLETED']).optional(),
  transactionReference: z.string().trim().max(120).nullish(),
  provider: z.string().trim().max(80).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

const verifySchema = z.object({
  status: z.enum([PaymentStatus.COMPLETED, PaymentStatus.FAILED]),
  providerReference: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
});

interface RawRequest {
  rawBody?: string;
  headers: Record<string, string | string[] | undefined>;
}

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('orders/:id/payments')
  @ApiOperation({ summary: 'List payment attempts for an authorized order' })
  findForOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.paymentsService.findForOrder(user, id);
  }

  @Get('orders/:id/payment-requirements')
  @ApiOperation({ summary: 'Get deposit and final-payment status for an order' })
  requirements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.paymentsService.requirements(user, id);
  }

  @Post('orders/:id/payments')
  @ApiOperation({ summary: 'Record a payment attempt; clients cannot claim online success' })
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body({ schema: paymentSchema }) body: z.infer<typeof paymentSchema>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.record(user, id, body, idempotencyKey);
  }

  @Get('payments')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List recent payments across the organization' })
  findAll() {
    return this.paymentsService.findAll();
  }

  @Post('payments/:id/verify')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Server-authoritative payment verification' })
  verify(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: verifySchema }) body: z.infer<typeof verifySchema>,
  ) {
    return this.paymentsService.verify(id, user, body);
  }

  @Post('payments/:id/refund')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Refund a payment with an audit record' })
  refund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: z.object({ reason: z.string().trim().min(3).max(500) }) })
    body: { reason: string },
  ) {
    return this.paymentsService.refund(id, user, body.reason);
  }

  @Post('payments/webhooks/:provider')
  @Public()
  @ApiOperation({ summary: 'Signed provider webhook for server-side payment status' })
  webhook(
    @Param('provider') provider: string,
    @Req() request: RawRequest,
    @Headers('x-listro-signature') signature?: string,
  ) {
    const raw = request.rawBody ?? '';
    return this.paymentsService.handleWebhook(provider, raw, signature);
  }
}
