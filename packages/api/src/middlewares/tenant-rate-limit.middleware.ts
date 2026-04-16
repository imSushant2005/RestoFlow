import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../services/cache.service';

/**
 * Tenant-scoped rate limiting using Redis.
 * Prevents a single misbehaving tenant from exhausting DB connections
 * or Redis bandwidth for other tenants.
 *
 * Limit: 150 requests per 2-second sliding window per tenant.
 * Extend or tighten via TENANT_RATE_LIMIT_MAX env var.
 */
const WINDOW_SECONDS = 2;
const MAX_REQUESTS = parseInt(process.env.TENANT_RATE_LIMIT_MAX || '150', 10);

export async function tenantRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantId = (req as any).tenantId as string | undefined;

  // No tenantId means the auth middleware hasn't run yet — skip
  if (!tenantId) {
    next();
    return;
  }

  try {
    const redis = getRedisClient();
    if (!redis) {
      // Redis not configured — fail open
      next();
      return;
    }

    const windowKey = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const key = `ratelimit:tenant:${tenantId}:${windowKey}`;

    const count = await redis.incr(key);
    if (count === 1) {
      // Set TTL only on first increment to avoid repeated EXPIRE calls
      await redis.expire(key, WINDOW_SECONDS * 2);
    }

    if (count > MAX_REQUESTS) {
      res.status(429).json({
        error: 'Too many requests. Please slow down.',
        retryAfter: WINDOW_SECONDS,
      });
      return;
    }
  } catch {
    // Redis failure — fail open (do not block requests if Redis is down)
  }

  next();
}
