import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';

@Module({
  imports: [AuditModule, NotificationsModule, OrdersModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
