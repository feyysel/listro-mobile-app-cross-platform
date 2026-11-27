import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';

@Module({
  imports: [OrdersModule, AuditModule, NotificationsModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
