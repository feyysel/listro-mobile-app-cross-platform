import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'provision'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  APP_URL: z.string().default('http://localhost:3001'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default('listro-local'),
  S3_REGION: z.string().optional().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional().default(''),
  S3_SECRET_KEY: z.string().optional().default(''),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().default('local-webhook-secret-change-me'),
});

export type Env = z.infer<typeof envSchema>;
