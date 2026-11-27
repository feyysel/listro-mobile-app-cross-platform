import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module.js';
import { AuthController, MeController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokensService } from './tokens.service.js';

@Module({
  imports: [JwtModule.register({}), AuditModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, TokensService],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
