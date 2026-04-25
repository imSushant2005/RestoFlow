"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./instrumentation");
const env_1 = require("./config/env");
const Sentry = __importStar(require("@sentry/node"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_http_1 = __importDefault(require("pino-http"));
const http_1 = require("http");
require("express-async-errors");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const table_routes_1 = __importDefault(require("./routes/table.routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const billing_routes_1 = __importDefault(require("./routes/billing.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const session_routes_1 = __importDefault(require("./routes/session.routes"));
const expense_routes_1 = __importDefault(require("./routes/expense.routes"));
const prisma_1 = require("./db/prisma");
const session_cleanup_service_1 = require("./services/session-cleanup.service");
const error_middleware_1 = require("./middlewares/error.middleware");
const socket_1 = require("./socket");
const logger_1 = require("./utils/logger");
const tracing_middleware_1 = require("./middlewares/tracing.middleware");
const tenant_rate_limit_middleware_1 = require("./middlewares/tenant-rate-limit.middleware");
const metrics_middleware_1 = require("./middlewares/metrics.middleware");
const cache_service_1 = require("./services/cache.service");
const runtime_metrics_service_1 = require("./services/runtime-metrics.service");
// Instrumentation handled by ./instrumentation
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const port = env_1.env.PORT || 4000;
const isProduction = env_1.env.NODE_ENV === 'production';
function buildAllowedOrigins() {
    if (env_1.env.ALLOWED_ORIGINS.length > 0)
        return env_1.env.ALLOWED_ORIGINS;
    if (!isProduction) {
        return [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3002',
        ];
    }
    return [];
}
const allowedOrigins = buildAllowedOrigins();
// Trusted origin patterns — used as fallback when CLIENT_URL / CORS_ORIGIN are not set.
function isOriginAllowed(origin) {
    // 1. Same-origin or server-to-server (no Origin header)
    if (!origin)
        return true;
    // 2. Explicitly allowed
    if (allowedOrigins.includes(origin))
        return true;
    // 3. Localhost (dev)
    if (!isProduction && (origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.') ||
        /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./.test(origin))) {
        return true;
    }
    if (isProduction) {
        console.warn(`[CORS_REJECT] Restricted origin attempt: ${origin}. Add to ALLOWED_ORIGINS if this is expected.`);
    }
    return false;
}
app.disable('x-powered-by');
if (env_1.env.TRUST_PROXY) {
    app.set('trust proxy', env_1.env.TRUST_PROXY);
}
// Observability and Tracing bounds
app.use(tracing_middleware_1.tracingMiddleware);
app.use(metrics_middleware_1.metricsMiddleware);
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (isOriginAllowed(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: env_1.env.PUBLIC_RATE_LIMIT_MAX,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
// C-7: Auth routes are brute-force targets — rate-limit them independently
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 auth requests per 15 min per IP
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const strictAuthLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Only 5 password reset attempts per hour per IP
    message: { error: 'Too many password reset attempts. Please try again in 1 hour.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/public', apiLimiter);
app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
app.use(express_1.default.json({ limit: env_1.env.JSON_BODY_LIMIT }));
app.use((0, cookie_parser_1.default)());
void (0, socket_1.initSocket)(httpServer).catch((error) => {
    logger_1.logger.error({ error }, 'Socket initialization failed');
    process.exit(1);
});
app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', uptimeSec: Math.round(process.uptime()) });
});
app.get('/health/ready', async (_req, res) => {
    const checks = {};
    let overallStatus = 'ready';
    let httpStatus = 200;
    // DB check
    try {
        await (0, prisma_1.checkPrismaReadiness)();
        checks.db = 'ok';
    }
    catch (error) {
        checks.db = 'unavailable';
        overallStatus = 'degraded';
        httpStatus = 503;
    }
    // Redis check (non-fatal — degrades caching and rate limiting but doesn't crash API)
    const redis = (0, cache_service_1.getRedisClient)();
    if (redis) {
        try {
            await redis.ping();
            checks.redis = 'ok';
        }
        catch {
            checks.redis = 'unavailable';
            if (overallStatus === 'ready')
                overallStatus = 'degraded';
        }
    }
    else {
        checks.redis = 'not_configured';
    }
    res.status(httpStatus).json({
        status: overallStatus,
        ...checks,
        version: '1.0.0',
        patch: 'v3-cors-hardened', // Version flag to verify deploy
        sockets: (0, socket_1.getSocketMetrics)(),
    });
});
app.get('/health', async (_req, res) => {
    try {
        await (0, prisma_1.checkPrismaReadiness)();
        res.json({ status: 'ok', version: '1.0.0', sockets: (0, socket_1.getSocketMetrics)() });
    }
    catch {
        res.status(503).json({ status: 'degraded', version: '1.0.0', sockets: (0, socket_1.getSocketMetrics)() });
    }
});
app.get('/metrics', async (_req, res) => {
    const redis = (0, cache_service_1.getRedisClient)();
    let redisStatus = 'not_configured';
    if (redis) {
        try {
            await redis.ping();
            redisStatus = 'ok';
        }
        catch {
            redisStatus = 'unavailable';
        }
    }
    const runtime = (0, runtime_metrics_service_1.getRuntimeMetricsSnapshot)();
    const pressureSignals = [
        ...(runtime.cache.hitRatePercent < 85 && runtime.cache.gets > 25 ? ['cache_hit_rate_low'] : []),
        ...(runtime.cache.redisFailures > 0 ? ['redis_failures_detected'] : []),
        ...(runtime.db.avgDurationMs > 350 ? ['db_avg_latency_high'] : []),
        ...(runtime.db.maxDurationMs > 1000 ? ['db_spike_detected'] : []),
        ...(runtime.jobs.sessionCleanup.lastRunDelayMs > 15_000 ? ['background_job_delay_high'] : []),
        ...((0, socket_1.getSocketMetrics)().activeConnections > 400 ? ['socket_pressure_high'] : []),
    ];
    res.json({
        generatedAt: new Date().toISOString(),
        http: (0, metrics_middleware_1.getHttpMetricsSnapshot)(),
        sockets: (0, socket_1.getSocketMetrics)(),
        runtime,
        dependencies: {
            redis: redisStatus,
        },
        process: {
            backgroundJobsEmbedded: env_1.env.RUN_BACKGROUND_JOBS,
            role: env_1.env.RUN_BACKGROUND_JOBS ? 'api-with-jobs' : 'api-only',
        },
        pressureSignals,
    });
});
// C-7: Auth rate limiters applied BEFORE the auth router
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password/reset', strictAuthLimiter);
app.use('/auth', auth_routes_1.default);
app.use('/menus', menu_routes_1.default);
app.use('/venue', table_routes_1.default);
app.use('/public', session_routes_1.default);
app.use('/public', public_routes_1.default);
app.use('/orders', tenant_rate_limit_middleware_1.tenantRateLimitMiddleware, order_routes_1.default);
app.use('/analytics', tenant_rate_limit_middleware_1.tenantRateLimitMiddleware, analytics_routes_1.default);
app.use('/settings', tenant_rate_limit_middleware_1.tenantRateLimitMiddleware, settings_routes_1.default);
app.use('/billing', tenant_rate_limit_middleware_1.tenantRateLimitMiddleware, billing_routes_1.default);
app.use('/ai', ai_routes_1.default);
app.use('/notifications', notification_routes_1.default);
app.use('/customer', customer_routes_1.default);
app.use('/expenses', tenant_rate_limit_middleware_1.tenantRateLimitMiddleware, expense_routes_1.default);
Sentry.setupExpressErrorHandler(app);
app.use(error_middleware_1.globalErrorHandler);
httpServer.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        logger_1.logger.error(`Port ${port} is already in use. Stop the existing process on ${port} and restart @bhojflow/api.`);
        process.exit(1);
    }
    logger_1.logger.error({ error }, 'HTTP server failed to start');
    process.exit(1);
});
httpServer.listen(port, () => {
    logger_1.logger.info(`BHOJFLOW API (V3 Enterprise) running on port ${port}`);
    if (env_1.env.RUN_BACKGROUND_JOBS) {
        logger_1.logger.info('Background jobs enabled inside API process');
        (0, session_cleanup_service_1.startSessionCleanupJob)();
    }
    else {
        logger_1.logger.warn('Background jobs disabled inside API process; worker process is required');
    }
});
//# sourceMappingURL=index.js.map