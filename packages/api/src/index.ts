import dotenv from 'dotenv';
dotenv.config(); // Must be FIRST before any other imports that read process.env
import { env } from './config/env'; // Triggers Zod validation immediately

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { globalErrorHandler } from './middlewares/error.middleware';
import 'express-async-errors'; // Pass async errors to the global handler
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import tableRoutes from './routes/table.routes';
import publicRoutes from './routes/public.routes';
import orderRoutes from './routes/order.routes';
import analyticsRoutes from './routes/analytics.routes';
import settingsRoutes from './routes/settings.routes';
import billingRoutes from './routes/billing.routes';
import paymentRoutes from './routes/payment.routes';
import aiRoutes from './routes/ai.routes';
import notificationRoutes from './routes/notification.routes';
import customerRoutes from './routes/customer.routes';
import sessionRoutes from './routes/session.routes';
import { initSocket } from './socket';


const app = express();
const httpServer = createServer(app);
const port = env.PORT || 4000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiting (100 reqs / 15 min per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/public', apiLimiter); // Stricter on unauthenticated routes

// Request Logging
app.use(pinoHttp({ logger }));

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

initSocket(httpServer);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/auth', authRoutes);
app.use('/menus', menuRoutes);
app.use('/venue', tableRoutes);
app.use('/public', publicRoutes);
app.use('/orders', orderRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/settings', settingsRoutes);
app.use('/billing', billingRoutes);
app.use('/payments', paymentRoutes);
app.use('/ai', aiRoutes);
app.use('/notifications', notificationRoutes);
app.use('/customer', customerRoutes);
app.use('/public', sessionRoutes);

// Global Error Handler must be the LAST middleware
app.use(globalErrorHandler);

httpServer.listen(port, () => {
  logger.info(`🚀 RESTOFLOW API (V3 Enterprise) running on port ${port}`);
});
