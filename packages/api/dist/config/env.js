"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const ENV_PATH_CANDIDATES = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), '../../.env'),
    path_1.default.resolve(__dirname, '../../../../.env'),
];
for (const candidate of ENV_PATH_CANDIDATES) {
    if (!fs_1.default.existsSync(candidate))
        continue;
    dotenv_1.default.config({ path: candidate, override: false });
}
const emptyToUndefined = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
};
const csvToList = (value) => String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
const boolish = zod_1.z
    .union([zod_1.z.boolean(), zod_1.z.string()])
    .optional()
    .transform((value) => {
    if (typeof value === 'boolean')
        return value;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
});
const envSchema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_DATABASE_URL: zod_1.z.string().optional(),
    JWT_SECRET: zod_1.z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16).optional(),
    REDIS_URL: zod_1.z
        .string()
        .optional()
        .transform((val) => {
        const v = emptyToUndefined(val);
        if (!v)
            return v;
        return v.includes('://') ? v : `redis://${v}`;
    }),
    CLOUDINARY_URL: zod_1.z.string().optional(),
    RAZORPAY_KEY_ID: zod_1.z.string().optional(),
    RAZORPAY_KEY_SECRET: zod_1.z.string().optional(),
    GEMINI_API_KEY: zod_1.z.string().optional(),
    TWILIO_ACCOUNT_SID: zod_1.z.string().optional(),
    TWILIO_AUTH_TOKEN: zod_1.z.string().optional(),
    TWILIO_PHONE_NUMBER: zod_1.z.string().optional(),
    VAPID_PUBLIC_KEY: zod_1.z.string().optional(),
    VAPID_PRIVATE_KEY: zod_1.z.string().optional(),
    ADMIN_SECRET_KEY: zod_1.z
        .string()
        .optional()
        .default('temporary-insecure-admin-secret-unblocked'),
    CLIENT_URL: zod_1.z.string().optional(),
    CORS_ORIGIN: zod_1.z.string().optional(),
    WS_ORIGINS: zod_1.z.string().optional(),
    TRUST_PROXY: zod_1.z.string().optional(),
    PUBLIC_RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(500),
    JSON_BODY_LIMIT: zod_1.z.string().default('1mb'),
    REQUIRE_REDIS_FOR_PROD: boolish,
    ENFORCE_TABLE_QR_SECRET: boolish,
    RUN_BACKGROUND_JOBS: boolish.default(true),
})
    .superRefine((value, ctx) => {
    const redisUrl = emptyToUndefined(value.REDIS_URL);
    const cloudinaryUrl = emptyToUndefined(value.CLOUDINARY_URL);
    const databaseUrl = emptyToUndefined(value.DATABASE_URL);
    const directDatabaseUrl = emptyToUndefined(value.DIRECT_DATABASE_URL);
    if (value.NODE_ENV === 'production' && !emptyToUndefined(value.ADMIN_SECRET_KEY)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'ADMIN_SECRET_KEY must be configured in production',
            path: ['ADMIN_SECRET_KEY'],
        });
    }
    if (redisUrl) {
        try {
            new URL(redisUrl);
        }
        catch {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'REDIS_URL must be a valid URL (starting with redis://)',
                path: ['REDIS_URL'],
            });
        }
    }
    if (cloudinaryUrl) {
        try {
            new URL(cloudinaryUrl);
        }
        catch {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'CLOUDINARY_URL must be a valid URL',
                path: ['CLOUDINARY_URL'],
            });
        }
    }
    if (databaseUrl?.includes('-pooler.') && !directDatabaseUrl) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'DIRECT_DATABASE_URL is required when DATABASE_URL points to a pooled Postgres host.',
            path: ['DIRECT_DATABASE_URL'],
        });
    }
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    const errors = parsed.error.format();
    if (errors.DATABASE_URL || errors.JWT_SECRET) {
        console.error('CRITICAL: Missing core configuration (DATABASE_URL/JWT_SECRET). Exiting.');
        process.exit(1);
    }
    console.warn('⚠️  Proceeding with partial/default configuration. PLEASE FIX THE ABOVE ERRORS.');
}
// Ensure data is never undefined by using process.env as base and merging defaults
const data = parsed.success ? parsed.data : {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 4000,
    ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || 'temporary-insecure-admin-secret-unblocked',
};
// Extra safety for production
if (process.env.NODE_ENV === 'production') {
    if (!data.ADMIN_SECRET_KEY ||
        data.ADMIN_SECRET_KEY === 'temporary-insecure-admin-secret-unblocked') {
        // HARD FAIL — an insecure admin secret in production is a critical vulnerability.
        // Set ADMIN_SECRET_KEY in Railway environment variables before deploying.
        console.error('\n🚨 FATAL: ADMIN_SECRET_KEY is unset or uses the insecure default in production.\n' +
            '   Set a strong, unique ADMIN_SECRET_KEY environment variable in Railway and redeploy.\n');
        process.exit(1);
    }
}
const allowedOrigins = Array.from(new Set([
    ...csvToList(data.CLIENT_URL),
    ...csvToList(data.CORS_ORIGIN),
    ...csvToList(data.WS_ORIGINS),
]));
exports.env = {
    ...data,
    DIRECT_DATABASE_URL: emptyToUndefined(data.DIRECT_DATABASE_URL),
    REDIS_URL: emptyToUndefined(data.REDIS_URL),
    CLOUDINARY_URL: emptyToUndefined(data.CLOUDINARY_URL),
    RAZORPAY_KEY_ID: emptyToUndefined(data.RAZORPAY_KEY_ID),
    RAZORPAY_KEY_SECRET: emptyToUndefined(data.RAZORPAY_KEY_SECRET),
    GEMINI_API_KEY: emptyToUndefined(data.GEMINI_API_KEY),
    TWILIO_ACCOUNT_SID: emptyToUndefined(data.TWILIO_ACCOUNT_SID),
    TWILIO_AUTH_TOKEN: emptyToUndefined(data.TWILIO_AUTH_TOKEN),
    TWILIO_PHONE_NUMBER: emptyToUndefined(data.TWILIO_PHONE_NUMBER),
    VAPID_PUBLIC_KEY: emptyToUndefined(data.VAPID_PUBLIC_KEY),
    VAPID_PRIVATE_KEY: emptyToUndefined(data.VAPID_PRIVATE_KEY),
    ADMIN_SECRET_KEY: emptyToUndefined(data.ADMIN_SECRET_KEY),
    TRUST_PROXY: emptyToUndefined(data.TRUST_PROXY),
    ALLOWED_ORIGINS: allowedOrigins,
};
//# sourceMappingURL=env.js.map