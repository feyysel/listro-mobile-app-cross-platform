import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators.js';
import { NotificationsService } from './notifications.service.js';

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z.coerce.boolean().default(false),
});

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the signed-in user' })
  findMine(
    @CurrentUser() user: { id: string },
    @Query({ schema: listSchema }) query: z.infer<typeof listSchema>,
  ) {
    return this.notificationsService.findMine(
      user.id,
      query.page,
      query.limit,
      query.unread,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAll(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }
}
