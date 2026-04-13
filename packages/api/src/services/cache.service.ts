import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

type MemoryCacheEntry = {
  expiresAt: number;
  value: string;
};

const memoryCache = new Map<string, MemoryCacheEntry>();
const isProduction = process.env.NODE_ENV === 'production';
const shouldUseRedis = Boolean(env.REDIS_URL);
const redisCache = shouldUseRedis
  ? new Redis(env.REDIS_URL as string, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableOfflineQueue: false,
      connectTimeout: 3000,
    })
  : null;
let hasLoggedRedisDisconnect = false;
let redisReady = false;
let redisConnectPromise: Promise<void> | null = null;
let redisRetryAfterMs = 0;

if (redisCache) {
  redisCache.on('error', (err) => {
    redisReady = false;
    if (!hasLoggedRedisDisconnect) {
      hasLoggedRedisDisconnect = true;
      logger.error({ err }, 'Redis Cache Service Disconnected');
    }
  });
  redisCache.on('connect', () => {
    redisReady = true;
    hasLoggedRedisDisconnect = false;
    logger.info('Redis Cache Service Connected');
  });
  redisCache.on('close', () => {
    redisReady = false;
  });
} else {
  logger.warn('REDIS_URL not configured. Using in-memory cache.');
}

function logCacheError(meta: Record<string, unknown>, message: string) {
  if (isProduction) {
    logger.error(meta, message);
  } else {
    console.warn(`[CACHE_DEBUG] ${message}`, meta);
  }
}

function setMemoryValue(key: string, value: unknown, ttlSeconds: number) {
  memoryCache.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function getMemoryValue(key: string) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value);
}

function deleteMemoryValue(pattern: string) {
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern.replace(/\*/g, ''))) {
      memoryCache.delete(key);
    }
  }
}

async function ensureRedisConnection() {
  if (!redisCache) return false;
  if (redisReady) return true;
  if (Date.now() < redisRetryAfterMs) return false;

  if (!redisConnectPromise) {
    redisConnectPromise = redisCache
      .connect()
      .then(() => {
        redisReady = true;
      })
      .catch((error) => {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 30_000;
        logCacheError({ error }, 'Redis unavailable, falling back to memory cache');
        try {
          if (redisCache.status !== 'end') {
            redisCache.disconnect();
          }
        } catch {}
      })
      .finally(() => {
        redisConnectPromise = null;
      });
  }

  await redisConnectPromise;
  return redisReady;
}

export const getCache = async <T = any>(key: string): Promise<T | null> => {
  try {
    if (!redisCache) {
      return getMemoryValue(key);
    }

    const canUseRedis = await ensureRedisConnection();
    if (!canUseRedis) {
      return getMemoryValue(key);
    }

    const data = await redisCache.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    redisReady = false;
    redisRetryAfterMs = Date.now() + 5_000;
    logCacheError({ key, error }, 'Cache Get Failed');
    return getMemoryValue(key);
  }
};

export const setCache = async (key: string, value: any, ttlSeconds: number = 3600) => {
  try {
    if (!redisCache) {
      setMemoryValue(key, value, ttlSeconds);
      return;
    }

    const canUseRedis = await ensureRedisConnection();
    if (!canUseRedis) {
      setMemoryValue(key, value, ttlSeconds);
      return;
    }

    await redisCache.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    redisReady = false;
    redisRetryAfterMs = Date.now() + 5_000;
    logCacheError({ key, error }, 'Cache Set Failed');
    setMemoryValue(key, value, ttlSeconds);
  }
};

export const deleteCache = async (pattern: string) => {
  try {
    if (!redisCache) {
      deleteMemoryValue(pattern);
      return;
    }

    const canUseRedis = await ensureRedisConnection();
    if (!canUseRedis) {
      deleteMemoryValue(pattern);
      return;
    }

    // Direct key deletion is safer for single keys, keys(*) for patterns
    if (pattern.includes('*')) {
      const keys = await redisCache.keys(pattern);
      if (keys.length > 0) {
        await redisCache.del(...keys);
      }
    } else {
      await redisCache.del(pattern);
    }
  } catch (error) {
    redisReady = false;
    redisRetryAfterMs = Date.now() + 5_000;
    logCacheError({ pattern, error }, 'Cache Delete Failed');
    deleteMemoryValue(pattern);
  }
};

/**
 * Executes a fallback function if cache miss, otherwise returns cached value.
 */
export async function withCache<T>(
  key: string,
  fallback: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fallback();
  await setCache(key, fresh, ttlSeconds);
  return fresh;
}
