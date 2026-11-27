import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { envSchema } from './config/env.validation.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { AdministrationModule } from './modules/administration/administration.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { RatingsModule } from './modules/ratings/ratings.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { HealthModule } from './modules/health/health.module.js';

const observeEnabled =
  !!process.env.OBSERVE_APP_KEY &&
  !!process.env.OBSERVE_APP_SECRET &&
  process.env.OBSERVE_APP_KEY !== 'YOUR_APP_KEY' &&
  process.env.OBSERVE_APP_SECRET !== 'YOUR_APP_SECRET';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
    }),
    ...(observeEnabled
      ? [
          ObserveModule.forRoot({
            appKey: process.env.OBSERVE_APP_KEY!,
            appSecret: process.env.OBSERVE_APP_SECRET!,
            serviceId: 'api',
          }),
        ]
      : []),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    JwtModule.register({}),
    PrismaModule,
    AuditModule,
    AuthModule,
    CustomersModule,
    CatalogModule,
    AdministrationModule,
    OrdersModule,
    OperationsModule,
    PaymentsModule,
    RatingsModule,
    NotificationsModule,
    ReportsModule,
    UploadsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
