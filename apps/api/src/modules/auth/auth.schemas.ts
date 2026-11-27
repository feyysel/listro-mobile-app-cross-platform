import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z.email().max(180),
  phone: z.string().trim().min(9).max(20).optional(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.email().max(180),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const emailSchema = z.object({
  email: z.email().max(180),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type EmailDto = z.infer<typeof emailSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
