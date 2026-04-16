import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

const ENV_PATH_CANDIDATES = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

for (const candidate of ENV_PATH_CANDIDATES) {
  if (!fs.existsSync(candidate)) continue;
  dotenv.config({ path: candidate, override: false });
}

const emptyToUndefined = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const csvToList = (value?: string | null) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const boolish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_REFRESH_SECRET: z.string().min(16).optional(),
    REDIS_URL: z.string().optional(),
    CLOUDINARY_URL: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    ADMIN_SECRET_KEY: z.string().optional(),
    CLIENT_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    WS_ORIGINS: z.string().optional(),
    TRUST_PROXY: z.string().optional(),
    PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),
    JSON_BODY_LIMIT: z.string().default('1mb'),
    REQUIRE_REDIS_FOR_PROD: boolish,
  })
  .superRefine((value, ctx) => {
    const redisUrl = emptyToUndefined(value.REDIS_URL);
    const cloudinaryUrl = emptyToUndefined(value.CLOUDINARY_URL);

    if (value.NODE_ENV === 'production' && !emptyToUndefined(value.ADMIN_SECRET_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ADMIN_SECRET_KEY must be configured in production',
        path: ['ADMIN_SECRET_KEY'],
      });
    }

    if (redisUrl) {
      try {
        new URL(redisUrl);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REDIS_URL must be a valid URL (starting with redis://)',
          path: ['REDIS_URL'],
        });
      }
    }

    if (cloudinaryUrl) {
      try {
        new URL(cloudinaryUrl);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLOUDINARY_URL must be a valid URL',
          path: ['CLOUDINARY_URL'],
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

const allowedOrigins = Array.from(
  new Set([
    ...csvToList(parsed.data.CLIENT_URL),
    ...csvToList(parsed.data.CORS_ORIGIN),
    ...csvToList(parsed.data.WS_ORIGINS),
  ]),
);

export const env = {
  ...parsed.data,
  DIRECT_DATABASE_URL: emptyToUndefined(parsed.data.DIRECT_DATABASE_URL),
  REDIS_URL: emptyToUndefined(parsed.data.REDIS_URL),
  CLOUDINARY_URL: emptyToUndefined(parsed.data.CLOUDINARY_URL),
  RAZORPAY_KEY_ID: emptyToUndefined(parsed.data.RAZORPAY_KEY_ID),
  RAZORPAY_KEY_SECRET: emptyToUndefined(parsed.data.RAZORPAY_KEY_SECRET),
  GEMINI_API_KEY: emptyToUndefined(parsed.data.GEMINI_API_KEY),
  TWILIO_ACCOUNT_SID: emptyToUndefined(parsed.data.TWILIO_ACCOUNT_SID),
  TWILIO_AUTH_TOKEN: emptyToUndefined(parsed.data.TWILIO_AUTH_TOKEN),
  TWILIO_PHONE_NUMBER: emptyToUndefined(parsed.data.TWILIO_PHONE_NUMBER),
  VAPID_PUBLIC_KEY: emptyToUndefined(parsed.data.VAPID_PUBLIC_KEY),
  VAPID_PRIVATE_KEY: emptyToUndefined(parsed.data.VAPID_PRIVATE_KEY),
  ADMIN_SECRET_KEY: emptyToUndefined(parsed.data.ADMIN_SECRET_KEY),
  TRUST_PROXY: emptyToUndefined(parsed.data.TRUST_PROXY),
  ALLOWED_ORIGINS: allowedOrigins,
} as const;
