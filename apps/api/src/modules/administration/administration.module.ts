import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import {
  BranchesController,
  EmployeesController,
} from './administration.controller.js';
import { BranchesService } from './branches.service.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [AuditModule],
  controllers: [BranchesController, EmployeesController],
  providers: [BranchesService, EmployeesService],
  exports: [BranchesService, EmployeesService],
})
export class AdministrationModule {}
