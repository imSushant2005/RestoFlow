"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Force resolution from the monorepo root irrespective of process.cwd()
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('4000'),
    DATABASE_URL: zod_1.z.string().url("Valid Neon DB URL is required"),
    JWT_SECRET: zod_1.z.string().min(16, "Must be at least 16 chars for secure signatures"),
    REDIS_URL: zod_1.z.string().optional(),
    CLOUDINARY_URL: zod_1.z.string().url("Cloudinary URL is required for file uploads").optional(),
    RAZORPAY_KEY_ID: zod_1.z.string().optional(),
    RAZORPAY_KEY_SECRET: zod_1.z.string().optional(),
    GEMINI_API_KEY: zod_1.z.string().min(20, "Google Gemini API key required for AI modules").optional(),
    TWILIO_ACCOUNT_SID: zod_1.z.string().optional(),
    TWILIO_AUTH_TOKEN: zod_1.z.string().optional(),
    TWILIO_PHONE_NUMBER: zod_1.z.string().optional(),
    VAPID_PUBLIC_KEY: zod_1.z.string().optional(),
    VAPID_PRIVATE_KEY: zod_1.z.string().optional(),
    ADMIN_SECRET_KEY: zod_1.z.string().default('super_secret_admin_restoflow_v3'),
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error("❌ Invalid environment variables:");
    console.error(_env.error.format());
    process.exit(1);
}
exports.env = _env.data;
//# sourceMappingURL=env.js.map