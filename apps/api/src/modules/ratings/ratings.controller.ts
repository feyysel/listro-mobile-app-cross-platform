import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { UserRole } from '../../generated/prisma/client.js';
import { RatingsService } from './ratings.service.js';

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullish(),
});

@ApiTags('Ratings')
@Controller('orders')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get(':id/rating')
  @ApiOperation({ summary: 'Get the rating for an order' })
  findForOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.ratingsService.findForOrder(user, id);
  }

  @Post(':id/rating')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Rate a delivered order' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body({ schema: ratingSchema }) body: z.infer<typeof ratingSchema>,
  ) {
    return this.ratingsService.submit(user, id, body);
  }
}
