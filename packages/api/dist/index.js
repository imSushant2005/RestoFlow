"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Must be FIRST before any other imports that read process.env
const env_1 = require("./config/env"); // Triggers Zod validation immediately
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_http_1 = __importDefault(require("pino-http"));
const logger_1 = require("./utils/logger");
const error_middleware_1 = require("./middlewares/error.middleware");
require("express-async-errors"); // Pass async errors to the global handler
const http_1 = require("http");
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
const socket_1 = require("./socket");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const port = env_1.env.PORT || 4000;
// Security Middlewares
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// Rate limiting for public routes (defaults to 500 req / 15 min per IP, configurable via PUBLIC_RATE_LIMIT_MAX)
const publicRateLimitMaxRaw = Number(process.env.PUBLIC_RATE_LIMIT_MAX || 500);
const publicRateLimitMax = Number.isFinite(publicRateLimitMaxRaw) && publicRateLimitMaxRaw > 0
    ? publicRateLimitMaxRaw
    : 500;
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: publicRateLimitMax,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/public', apiLimiter); // Stricter on unauthenticated routes
// Request Logging
app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
app.use((0, cors_1.default)({
    origin: true,
    credentials: true
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
(0, socket_1.initSocket)(httpServer);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
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
// Global Error Handler must be the LAST middleware
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