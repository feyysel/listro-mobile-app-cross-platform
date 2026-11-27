import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { AuthService, RequestContext } from './auth.service.js';
import {
  emailSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  type EmailDto,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
  type ResetPasswordDto,
} from './auth.schemas.js';

interface HttpRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const contextOf = (request: HttpRequest): RequestContext => ({
  ipAddress: request.ip ?? null,
  userAgent: Array.isArray(request.headers['user-agent'])
    ? request.headers['user-agent'][0]
    : (request.headers['user-agent'] ?? null),
});

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a customer account and receive tokens' })
  register(
    @Body({ schema: registerSchema }) body: RegisterDto,
    @Req() request: HttpRequest,
  ) {
    return this.authService.register(body, contextOf(request));
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in and receive access and refresh tokens' })
  login(
    @Body({ schema: loginSchema }) body: LoginDto,
    @Req() request: HttpRequest,
  ) {
    return this.authService.login(body, contextOf(request));
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(@Body({ schema: refreshSchema }) body: RefreshDto) {
    return this.authService.refresh(body);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current refresh-token family' })
  logout(
    @Body({ schema: refreshSchema }) body: RefreshDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.logout(body.refreshToken, user.id);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(202)
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a single-use password reset token' })
  forgotPassword(@Body({ schema: emailSchema }) body: EmailDto) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset a password with a single-use token' })
  resetPassword(
    @Body({ schema: resetPasswordSchema }) body: ResetPasswordDto,
    @Req() request: HttpRequest,
  ) {
    return this.authService.resetPassword(body, contextOf(request));
  }
}

@ApiTags('Current user')
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'Get the signed-in user profile and permissions' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
