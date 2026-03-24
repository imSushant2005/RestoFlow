import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

type MemoryCacheEntry = {
  expiresAt: number;
  value: string;
};

const memoryCache = new Map<string, MemoryCacheEntry>();
const isProduction = process.env.NODE_ENV === 'production';
const shouldUseRedis = Boolean(env.REDIS_URL) && isProduction;
const redisCache = shouldUseRedis
  ? new Redis(env.REDIS_URL as string, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableOfflineQueue: false,
      connectTimeout: 1500,
    })
  : null;
let hasLoggedRedisDisconnect = false;

if (redisCache) {
  redisCache.on('error', (err) => {
    if (!hasLoggedRedisDisconnect) {
      hasLoggedRedisDisconnect = true;
      logger.error({ err }, 'Redis Cache Service Disconnected');
    }
  });
} else {
  if (!env.REDIS_URL && isProduction) {
    logger.warn('REDIS_URL not configured. Falling back to in-memory cache.');
  }
}

function logCacheError(meta: Record<string, unknown>, message: string) {
  if (isProduction) {
    logger.error(meta, message);
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

export const getCache = async (key: string) => {
  try {
    if (!redisCache) {
      return getMemoryValue(key);
    }

    const data = await redisCache.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
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

    await redisCache.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
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

    const keys = await redisCache.keys(pattern);
    if (keys.length > 0) {
      await redisCache.del(...keys);
    }
  } catch (error) {
    logCacheError({ pattern, error }, 'Cache Delete Failed');
    deleteMemoryValue(pattern);
  }
};
