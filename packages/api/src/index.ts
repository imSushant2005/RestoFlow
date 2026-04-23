import './instrumentation';
import { env } from './config/env';
import * as Sentry from '@sentry/node';
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
import expenseRoutes from './routes/expense.routes';
import { checkPrismaReadiness } from './db/prisma';
import { startSessionCleanupJob } from './services/session-cleanup.service';
import { globalErrorHandler } from './middlewares/error.middleware';
import { initSocket, getSocketMetrics } from './socket';
import { logger } from './utils/logger';
import { tracingMiddleware } from './middlewares/tracing.middleware';
import { tenantRateLimitMiddleware } from './middlewares/tenant-rate-limit.middleware';
import { getHttpMetricsSnapshot, metricsMiddleware } from './middlewares/metrics.middleware';
import { getRedisClient } from './services/cache.service';
import { getRuntimeMetricsSnapshot } from './services/runtime-metrics.service';

// Instrumentation handled by ./instrumentation

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

// Trusted origin patterns — used as fallback when CLIENT_URL / CORS_ORIGIN are not set.
const TRUSTED_ORIGIN_PATTERNS = [
  /\.vercel\.app$/,
  /\.railway\.app$/,
  /\.up\.railway\.app$/,
];

function isOriginAllowed(origin?: string | null) {
  // 1. Same-origin or server-to-server (no Origin header)
  if (!origin) return true;

  // 2. Explicitly allowed
  if (allowedOrigins.includes(origin)) return true;

  // 3. Localhost (dev)
  if (!isProduction && (
    origin.startsWith('http://localhost:') || 
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://192.168.') ||
    origin.startsWith('http://10.') ||
    /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./.test(origin)
  )) {
    return true;
  }

  // 4. Pattern match (vercel/railway)
  // Use a simple check to catch if the origin ends with a trusted domain
  const isTrusted = TRUSTED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
  
  if (!isTrusted && isProduction) {
    console.warn(`[CORS_REJECT] Restricted origin attempt: ${origin}. Add to CLIENT_URL if this is expected.`);
  }

  return isTrusted;
}

app.disable('x-powered-by');
if (env.TRUST_PROXY) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// Observability and Tracing bounds
app.use(tracingMiddleware);
app.use(metricsMiddleware);

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

// C-7: Auth routes are brute-force targets — rate-limit them independently
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 auth requests per 15 min per IP
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // Only 5 password reset attempts per hour per IP
  message: { error: 'Too many password reset attempts. Please try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/public', apiLimiter);
app.use(pinoHttp({ logger }));
// Removed cors() from here as it's now at the top
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
  const checks: Record<string, string> = {};
  let overallStatus = 'ready';
  let httpStatus = 200;

  // DB check
  try {
    await checkPrismaReadiness();
    checks.db = 'ok';
  } catch (error) {
    checks.db = 'unavailable';
    overallStatus = 'degraded';
    httpStatus = 503;
  }

  // Redis check (non-fatal — degrades caching and rate limiting but doesn't crash API)
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'unavailable';
      if (overallStatus === 'ready') overallStatus = 'degraded';
    }
  } else {
    checks.redis = 'not_configured';
  }

  res.status(httpStatus).json({
    status: overallStatus,
    ...checks,
    version: '1.0.0',
    patch: 'v3-cors-hardened', // Version flag to verify deploy
    sockets: getSocketMetrics(),
  });
});

app.get('/health', async (_req, res) => {
  try {
    await checkPrismaReadiness();
    res.json({ status: 'ok', version: '1.0.0', sockets: getSocketMetrics() });
  } catch {
    res.status(503).json({ status: 'degraded', version: '1.0.0', sockets: getSocketMetrics() });
  }
});

app.get('/metrics', async (_req, res) => {
  const redis = getRedisClient();
  let redisStatus = 'not_configured';
  if (redis) {
    try {
      await redis.ping();
      redisStatus = 'ok';
    } catch {
      redisStatus = 'unavailable';
    }
  }

  const runtime = getRuntimeMetricsSnapshot();
  const pressureSignals = [
    ...(runtime.cache.hitRatePercent < 85 && runtime.cache.gets > 25 ? ['cache_hit_rate_low'] : []),
    ...(runtime.cache.redisFailures > 0 ? ['redis_failures_detected'] : []),
    ...(runtime.db.avgDurationMs > 350 ? ['db_avg_latency_high'] : []),
    ...(runtime.db.maxDurationMs > 1000 ? ['db_spike_detected'] : []),
    ...(runtime.jobs.sessionCleanup.lastRunDelayMs > 15_000 ? ['background_job_delay_high'] : []),
    ...(getSocketMetrics().activeConnections > 400 ? ['socket_pressure_high'] : []),
  ];

  res.json({
    generatedAt: new Date().toISOString(),
    http: getHttpMetricsSnapshot(),
    sockets: getSocketMetrics(),
    runtime,
    dependencies: {
      redis: redisStatus,
    },
    process: {
      backgroundJobsEmbedded: env.RUN_BACKGROUND_JOBS,
      role: env.RUN_BACKGROUND_JOBS ? 'api-with-jobs' : 'api-only',
    },
    pressureSignals,
  });
});

// C-7: Auth rate limiters applied BEFORE the auth router
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password/reset', strictAuthLimiter);
app.use('/auth', authRoutes);
app.use('/menus', menuRoutes);
app.use('/venue', tableRoutes);
app.use('/public', sessionRoutes);
app.use('/public', publicRoutes);
app.use('/orders', tenantRateLimitMiddleware, orderRoutes);
app.use('/analytics', tenantRateLimitMiddleware, analyticsRoutes);
app.use('/settings', tenantRateLimitMiddleware, settingsRoutes);
app.use('/billing', tenantRateLimitMiddleware, billingRoutes);
app.use('/payments', paymentRoutes);
app.use('/ai', aiRoutes);
app.use('/notifications', notificationRoutes);
app.use('/customer', customerRoutes);
app.use('/expenses', tenantRateLimitMiddleware, expenseRoutes);

Sentry.setupExpressErrorHandler(app);
app.use(globalErrorHandler);

httpServer.on('error', (error: any) => {
  if (error?.code === 'EADDRINUSE') {
    logger.error(
      `Port ${port} is already in use. Stop the existing process on ${port} and restart @bhojflow/api.`,
    );
    process.exit(1);
  }
  logger.error({ error }, 'HTTP server failed to start');
  process.exit(1);
});

httpServer.listen(port, () => {
  logger.info(`BHOJFLOW API (V3 Enterprise) running on port ${port}`);
  
  if (env.RUN_BACKGROUND_JOBS) {
    logger.info('Background jobs enabled inside API process');
    startSessionCleanupJob();
  } else {
    logger.warn('Background jobs disabled inside API process; worker process is required');
  }
});
