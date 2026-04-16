import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';

interface StandardError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const globalErrorHandler = (
  err: StandardError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  Sentry.setContext("Request Context", {
    requestId: req.id,
    tenantId: (req as any).tenantId,
    userId: (req as any).user?.id,
    role: (req as any).user?.role,
    deviceId: req.headers['x-device-id'],
    orderId: req.params.id,
    sessionId: req.params.sessionId,
    idempotencyKey: req.headers['x-idempotency-key']
  });

  // Automatically Catch Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = (err as any).errors.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    
    logger.warn({ path: req.path, method: req.method, ip: req.ip, errors: formattedErrors }, 'Validation Error');
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      validation: formattedErrors,
    });
    return;
  }

  // Catch known Prisma database errors (Optional refinement based on Prisma code strings)
  if (err.name === 'PrismaClientKnownRequestError') {
    logger.error({ err, path: req.path }, 'Database Request Error');
    res.status(400).json({
      success: false,
      error: 'Database constraint violation.',
      ...(isDevelopment && { details: err.message })
    });
    return;
  }

  // Log 500s directly to infrastructure
  if (statusCode === 500) {
    logger.error({ err, path: req.path, method: req.method, ip: req.ip }, '💥 Unhandled Server Exception');
  } else {
    logger.warn({ err: err.message, path: req.path }, `Operational Error (${statusCode})`);
  }

  res.status(statusCode).json({
    success: false,
    error: err.isOperational ? err.message : 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }), // Leak stack trace only heavily in internal tests
  });
};
