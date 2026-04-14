"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
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
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const session_routes_1 = __importDefault(require("./routes/session.routes"));
const prisma_1 = require("./db/prisma");
const error_middleware_1 = require("./middlewares/error.middleware");
const socket_1 = require("./socket");
const logger_1 = require("./utils/logger");
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
function isOriginAllowed(origin) {
    if (!origin)
        return !isProduction || allowedOrigins.length === 0;
    return allowedOrigins.includes(origin);
}
app.disable('x-powered-by');
if (env_1.env.TRUST_PROXY) {
    app.set('trust proxy', env_1.env.TRUST_PROXY);
}
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
app.use('/public', apiLimiter);
app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
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
    try {
        await (0, prisma_1.checkPrismaReadiness)();
        res.json({
            status: 'ready',
            db: 'ok',
            sockets: (0, socket_1.getSocketMetrics)(),
            version: '1.0.0',
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'degraded',
            db: 'unavailable',
            sockets: (0, socket_1.getSocketMetrics)(),
            error: error instanceof Error ? error.message : 'Database readiness failed',
        });
    }
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
app.use('/auth', auth_routes_1.default);
app.use('/menus', menu_routes_1.default);
app.use('/venue', table_routes_1.default);
app.use('/public', public_routes_1.default);
app.use('/orders', order_routes_1.default);
app.use('/analytics', analytics_routes_1.default);
app.use('/settings', settings_routes_1.default);
app.use('/billing', billing_routes_1.default);
app.use('/payments', payment_routes_1.default);
app.use('/ai', ai_routes_1.default);
app.use('/notifications', notification_routes_1.default);
app.use('/customer', customer_routes_1.default);
app.use('/public', session_routes_1.default);
app.use(error_middleware_1.globalErrorHandler);
httpServer.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        logger_1.logger.error(`Port ${port} is already in use. Stop the existing process on ${port} and restart @dineflow/api.`);
        process.exit(1);
    }
    logger_1.logger.error({ error }, 'HTTP server failed to start');
    process.exit(1);
});
httpServer.listen(port, () => {
    logger_1.logger.info(`RESTOFLOW API (V3 Enterprise) running on port ${port}`);
});
//# sourceMappingURL=index.js.map