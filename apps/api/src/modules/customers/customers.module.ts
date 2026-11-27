import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AddressesController } from './addresses.controller.js';
import { AddressesService } from './addresses.service.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [AuditModule],
  controllers: [AddressesController, CustomersController],
  providers: [AddressesService, CustomersService],
  exports: [AddressesService, CustomersService],
})
export class CustomersModule {}
