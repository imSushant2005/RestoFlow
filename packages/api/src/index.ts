import { env } from './config/env';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { createServer } from 'http';
import 'express-async-errors';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import tableRoutes from './routes/table.routes';
import publicRoutes from './routes/public.routes';
import orderRoutes from './routes/order.routes';
import analyticsRoutes from './routes/analytics.routes';
import settingsRoutes from './routes/settings.routes';
import billingRoutes from './routes/billing.routes';
import paymentRoutes from './routes/payment.routes';
import * as PaymentController from './controllers/payment.controller';
import aiRoutes from './routes/ai.routes';
import notificationRoutes from './routes/notification.routes';
import customerRoutes from './routes/customer.routes';
import sessionRoutes from './routes/session.routes';
import { checkPrismaReadiness } from './db/prisma';
import { globalErrorHandler } from './middlewares/error.middleware';
import { initSocket, getSocketMetrics } from './socket';
import { logger } from './utils/logger';
import { tracingMiddleware } from './middlewares/tracing.middleware';
import { tenantRateLimitMiddleware } from './middlewares/tenant-rate-limit.middleware';

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://public@sentry.example.com/1',
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
  profilesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
});

const app = express();
const httpServer = createServer(app);
const port = env.PORT || 4000;
const isProduction = env.NODE_ENV === 'production';

function buildAllowedOrigins() {
  if (env.ALLOWED_ORIGINS.length > 0) return env.ALLOWED_ORIGINS;
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

function isOriginAllowed(origin?: string | null) {
  if (!origin) return !isProduction || allowedOrigins.length === 0;
  return allowedOrigins.includes(origin);
}

app.disable('x-powered-by');
if (env.TRUST_PROXY) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// Observability and Tracing bounds
app.use(tracingMiddleware);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.PUBLIC_RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/public', apiLimiter);
app.use(pinoHttp({ logger }));
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.post('/payments/webhook', express.raw({ type: 'application/json' }), PaymentController.handleWebhook);
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(cookieParser());

void initSocket(httpServer).catch((error) => {
  logger.error({ error }, 'Socket initialization failed');
  process.exit(1);
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'ok', uptimeSec: Math.round(process.uptime()) });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await checkPrismaReadiness();
    res.json({
      status: 'ready',
      db: 'ok',
      sockets: getSocketMetrics(),
      version: '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      db: 'unavailable',
      sockets: getSocketMetrics(),
      error: error instanceof Error ? error.message : 'Database readiness failed',
    });
  }
});

app.get('/health', async (_req, res) => {
  try {
    await checkPrismaReadiness();
    res.json({ status: 'ok', version: '1.0.0', sockets: getSocketMetrics() });
  } catch {
    res.status(503).json({ status: 'degraded', version: '1.0.0', sockets: getSocketMetrics() });
  }
});

app.use('/auth', authRoutes);
app.use('/menus', menuRoutes);
app.use('/venue', tableRoutes);
app.use('/public', publicRoutes);
app.use('/orders', tenantRateLimitMiddleware, orderRoutes);
app.use('/analytics', tenantRateLimitMiddleware, analyticsRoutes);
app.use('/settings', tenantRateLimitMiddleware, settingsRoutes);
app.use('/billing', tenantRateLimitMiddleware, billingRoutes);
app.use('/payments', paymentRoutes);
app.use('/ai', aiRoutes);
app.use('/notifications', notificationRoutes);
app.use('/customer', customerRoutes);
app.use('/public', sessionRoutes);

Sentry.setupExpressErrorHandler(app);
app.use(globalErrorHandler);

httpServer.on('error', (error: any) => {
  if (error?.code === 'EADDRINUSE') {
    logger.error(
      `Port ${port} is already in use. Stop the existing process on ${port} and restart @dineflow/api.`,
    );
    process.exit(1);
  }
  logger.error({ error }, 'HTTP server failed to start');
  process.exit(1);
});

httpServer.listen(port, () => {
  logger.info(`RESTOFLOW API (V3 Enterprise) running on port ${port}`);
});
