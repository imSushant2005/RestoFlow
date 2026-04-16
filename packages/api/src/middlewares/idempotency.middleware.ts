import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRedisClient } from '../services/cache.service';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  if (!idempotencyKey) {
    next();
    return;
  }

  const tenantId = (req as any).tenantId || 'unknown';
  const route = req.baseUrl + req.path;
  const redisKey = `idempotency:${route}:${tenantId}:${idempotencyKey}`;
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');

  const redis = getRedisClient();
  if (!redis) {
    next();
    return;
  }

  try {
    const existingRaw = await redis.get(redisKey);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);

      if (existing.bodyHash !== bodyHash) {
        res.status(400).json({ error: 'Idempotency key reused with different payload' });
        return;
      }

      if (existing.state === 'PROCESSING') {
        res.status(202).json({
          state: 'PROCESSING',
          message: 'Identical request is already being processed.',
          idempotencyKey
        });
        return;
      }

      if (existing.state === 'COMPLETED') {
        res.status(existing.response.statusCode).json(existing.response.data);
        return;
      }

      // If FAILED, proceed to let them retry
    }

    // Set state to PROCESSING (Atomic lock)
    const initialPayload = {
      state: 'PROCESSING',
      bodyHash,
      createdAt: new Date().toISOString(),
    };

    const setnxResult = await redis.set(redisKey, JSON.stringify(initialPayload), 'EX', 86400, 'NX');
    if (!setnxResult) {
      // It was set by another concurrent request immediately after our GET check
      res.status(202).json({
        state: 'PROCESSING',
        message: 'Identical request is already being processed.',
        idempotencyKey
      });
      return;
    }

    // Override res.json to capture response output seamlessly
    const originalJson = res.json;
    res.json = function (body: any) {
      const statusCode = res.statusCode;
      const isError = statusCode >= 400;

      const finalPayload = {
        state: isError ? 'FAILED' : 'COMPLETED',
        bodyHash,
        createdAt: initialPayload.createdAt,
        expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
        response: {
          statusCode,
          data: body
        }
      };

      // Save asynchronously without blocking the reply
      redis.set(redisKey, JSON.stringify(finalPayload), 'EX', 86400).catch(err => {
         console.error('Failed to save idempotency completion', err);
      });

      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    next();
  }
};
