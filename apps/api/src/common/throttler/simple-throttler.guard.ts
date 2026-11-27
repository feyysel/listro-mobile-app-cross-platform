import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

type ThrottleLimit = { limit: number; ttl: number };
type ThrottleOptions = Record<string, ThrottleLimit>;

export const THROTTLE_METADATA_KEY = 'app:throttle';

export const Throttle = (options: ThrottleOptions): MethodDecorator =>
  (target, propertyKey, descriptor) => {
    if (descriptor.value) {
      Reflect.defineMetadata(THROTTLE_METADATA_KEY, options, descriptor.value);
    }
    return descriptor;
  };

interface HitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class SimpleThrottlerGuard implements CanActivate {
  private readonly hits = new Map<string, HitBucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const options = this.reflector.getAllAndOverride<ThrottleOptions | undefined>(
      THROTTLE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    const limit = options?.default ?? { limit: 100, ttl: 60_000 };

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      method?: string;
      route?: { path?: string };
      url?: string;
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader: (name: string, value: number | string) => void;
    }>();

    const now = Date.now();
    const key = [
      request.ip ?? 'unknown',
      context.getClass().name,
      context.getHandler().name,
      request.method ?? 'GET',
      request.route?.path ?? request.url ?? '',
      limit.ttl,
    ].join(':');

    const bucket = this.hits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + limit.ttl });
      this.setHeaders(response, limit.limit, limit.limit - 1, now + limit.ttl);
      this.cleanup(now);
      return true;
    }

    bucket.count += 1;
    const remaining = Math.max(0, limit.limit - bucket.count);
    this.setHeaders(response, limit.limit, remaining, bucket.resetAt);

    if (bucket.count > limit.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      response.setHeader('Retry-After', retryAfter);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'ThrottlerException: Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private setHeaders(
    response: { setHeader: (name: string, value: number | string) => void },
    limit: number,
    remaining: number,
    resetAt: number,
  ) {
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
  }

  private cleanup(now: number) {
    if (this.hits.size < 5000) return;
    for (const [key, bucket] of this.hits) {
      if (bucket.resetAt <= now) this.hits.delete(key);
    }
  }
}
