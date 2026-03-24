import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Force resolution from the monorepo root irrespective of process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('4000'),
  DATABASE_URL: z.string().url("Valid Neon DB URL is required"),
  JWT_SECRET: z.string().min(16, "Must be at least 16 chars for secure signatures"),
  REDIS_URL: z.string().url("A generic Redis connection is required for multi-tenant scalability").optional(),
  CLOUDINARY_URL: z.string().url("Cloudinary URL is required for file uploads").optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().min(20, "Google Gemini API key required for AI modules").optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  ADMIN_SECRET_KEY: z.string().default('super_secret_admin_restoflow_v3'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:");
  console.error(_env.error.format());
  process.exit(1);
}

export const env = _env.data;
