import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { UploadsService } from './uploads.service.js';

const signSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().regex(/^image\/(jpeg|png|webp)$/),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  entityType: z.string().trim().max(80).nullish(),
  entityId: z.string().trim().max(100).nullish(),
});

@ApiTags('File uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('sign')
  @ApiOperation({ summary: 'Create private object-storage metadata and a short-lived upload URL' })
  sign(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: signSchema }) body: z.infer<typeof signSchema>,
  ) {
    return this.uploadsService.signUpload(user, body);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Get a short-lived signed URL for an authorized file' })
  signedUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.uploadsService.signedUrl(user, id);
  }
}
