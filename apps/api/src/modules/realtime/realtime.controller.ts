import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { CurrentUser } from '../../common/decorators.js';
import type { RealtimeEvent } from './realtime.service.js';
import { RealtimeService } from './realtime.service.js';

@ApiTags('Realtime')
@Controller()
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse('events')
  @ApiOperation({ summary: 'Stream live notification and order events for the current user' })
  events(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let since = new Date(Date.now() - 1000);
      const seen = new Set<string>();

      const emit = (event: RealtimeEvent) => {
        if (seen.has(event.id)) return;
        seen.add(event.id);
        if (seen.size > 500) {
          const oldest = seen.values().next().value;
          if (oldest) seen.delete(oldest);
        }
        subscriber.next({ id: event.id, type: event.type, data: event.data });
      };

      const unsubscribe = this.realtime.subscribe(user.id, emit);
      const poll = setInterval(() => {
        void this.realtime
          .recentNotifications(user.id, since)
          .then((events) => {
            for (const event of events) emit(event);
            since = new Date();
          })
          .catch(() => {});
      }, 2000);
      const heartbeat = setInterval(() => {
        subscriber.next({ type: 'ping', data: { at: Date.now() } });
      }, 15000);

      subscriber.next({ type: 'ready', data: { at: Date.now() } });

      return () => {
        clearInterval(poll);
        clearInterval(heartbeat);
        unsubscribe();
        seen.clear();
      };
    });
  }
}
