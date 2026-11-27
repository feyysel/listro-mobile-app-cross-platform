import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [AuditModule, NotificationsModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
