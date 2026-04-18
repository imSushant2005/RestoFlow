import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  recordCacheDelete,
  recordCacheError,
  recordCacheRead,
  recordCacheWrite,
  recordRedisFailure,
  setRedisState,
} from './runtime-metrics.service';

type MemoryCacheEntry = {
  expiresAt: number;
  value: string;
};

const memoryCache = new Map<string, MemoryCacheEntry>();
const inFlightCacheLoads = new Map<string, Promise<unknown>>();
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
  setRedisState('connecting');
  redisCache.on('error', (err) => {
    redisReady = false;
    recordRedisFailure(err);
    if (!hasLoggedRedisDisconnect) {
      hasLoggedRedisDisconnect = true;
      logger.error({ err }, 'Redis Cache Service Disconnected');
    }
  });
  redisCache.on('connect', () => {
    redisReady = false;
    setRedisState('connecting');
  });
  redisCache.on('ready', () => {
    redisReady = true;
    setRedisState('ready');
    hasLoggedRedisDisconnect = false;
    logger.info('Redis Cache Service Ready');
  });
  redisCache.on('close', () => {
    redisReady = false;
    setRedisState('unavailable');
  });
} else {
  setRedisState('not_configured');
  logger.warn('REDIS_URL not configured. Using in-memory cache.');
}

function logCacheError(meta: Record<string, unknown>, message: string) {
  recordCacheError(meta.error);
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

function shouldUseMemoryFallback() {
  return !shouldUseRedis || !isProduction;
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deleteMemoryValue(pattern: string) {
  if (!pattern.includes('*')) {
    memoryCache.delete(pattern);
    return;
  }

  const regex = new RegExp(`^${pattern.split('*').map(escapeRegex).join('.*')}$`);
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

function isRedisCommandReady() {
  return redisCache != null && redisCache.status === 'ready' && redisReady;
}

async function ensureRedisConnection() {
  if (!redisCache) return false;
  if (isRedisCommandReady()) return true;
  if (Date.now() < redisRetryAfterMs) return false;

  if (!redisConnectPromise) {
    redisConnectPromise = redisCache
      .connect()
      .then(() => {
        redisReady = redisCache.status === 'ready';
      })
      .catch((error) => {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 30_000;
        logCacheError(
          { error, fallback: shouldUseMemoryFallback() ? 'memory' : 'cache_bypass' },
          'Redis unavailable during cache connect',
        );
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
  return isRedisCommandReady();
}

export const getCache = async <T = any>(key: string): Promise<T | null> => {
  try {
    if (!redisCache) {
      const memoryValue = getMemoryValue(key);
      recordCacheRead(memoryValue !== null, 'memory');
      return memoryValue;
    }

    const canUseRedis = await ensureRedisConnection();
    if (!canUseRedis) {
      if (shouldUseMemoryFallback()) {
        const memoryValue = getMemoryValue(key);
        recordCacheRead(memoryValue !== null, 'memory');
        return memoryValue;
      }
      recordCacheRead(false, 'bypass');
      return null;
    }

    if (!isRedisCommandReady()) {
      redisReady = false;
      setRedisState('unavailable');
      if (shouldUseMemoryFallback()) {
        const memoryValue = getMemoryValue(key);
        recordCacheRead(memoryValue !== null, 'memory');
        return memoryValue;
      }
      recordCacheRead(false, 'bypass');
      return null;
    }

    const data = await redisCache.get(key);
    recordCacheRead(Boolean(data), 'redis');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    redisReady = false;
    redisRetryAfterMs = Date.now() + 5_000;
    logCacheError({ key, error }, 'Cache Get Failed');
    if (shouldUseMemoryFallback()) {
      const memoryValue = getMemoryValue(key);
      recordCacheRead(memoryValue !== null, 'memory');
      return memoryValue;
    }
    recordCacheRead(false, 'bypass');
    return null;
  }
};

export const setCache = async (key: string, value: any, ttlSeconds: number = 3600) => {
  try {
    if (!redisCache) {
      setMemoryValue(key, value, ttlSeconds);
      recordCacheWrite('memory');
      return;
    }

    const canUseRedis = await ensureRedisConnection();
    if (!canUseRedis) {
      if (shouldUseMemoryFallback()) {
        setMemoryValue(key, value, ttlSeconds);
        recordCacheWrite('memory');
      } else {
        recordCacheWrite('bypass');
      }
      return;
    }

    if (!isRedisCommandReady()) {
      redisReady = false;
      setRedisState('unavailable');
      if (shouldUseMemoryFallback()) {
        setMemoryValue(key, value, ttlSeconds);
        recordCacheWrite('memory');
      } else {
        recordCacheWrite('bypass');
      }
      return;
    }

    await redisCache.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    recordCacheWrite('redis');
  } catch (error) {
    redisReady = false;
    redisRetryAfterMs = Date.now() + 5_000;
    logCacheError({ key, error }, 'Cache Set Failed');
    if (shouldUseMemoryFallback()) {
      setMemoryValue(key, value, ttlSeconds);
      recordCacheWrite('memory');
    } else {
      recordCacheWrite('bypass');
    }
  }
};

export const deleteCache = async (pattern: string) => {
  try {
    if (!redisCache) {
      deleteMemoryValue(pattern);
      recordCacheDelete();
      return;
    }

    const canUseRedis = await ensureRedisConnection();
    if (!canUseRedis) {
      if (shouldUseMemoryFallback()) {
        deleteMemoryValue(pattern);
      }
      recordCacheDelete();
      return;
    }

    if (!isRedisCommandReady()) {
      redisReady = false;
      setRedisState('unavailable');
      if (shouldUseMemoryFallback()) {
        deleteMemoryValue(pattern);
      }
      recordCacheDelete();
      return;
    }

    if (pattern.includes('*')) {
      // Use SCAN instead of KEYS to avoid blocking the Redis event loop.
      // KEYS is O(N) and freezes all Redis operations during the scan.
      // SCAN iterates in batches of 100 without holding a global lock.
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redisCache.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisCache.del(...keys);
        }
      } while (cursor !== '0');
    } else {
      await redisCache.del(pattern);
    }
    recordCacheDelete();
  } catch (error) {
    redisReady = false;
    redisRetryAfterMs = Date.now() + 5_000;
    logCacheError({ pattern, error }, 'Cache Delete Failed');
    if (shouldUseMemoryFallback()) {
      deleteMemoryValue(pattern);
    }
    recordCacheDelete();
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

  const existingLoad = inFlightCacheLoads.get(key);
  if (existingLoad) {
    return existingLoad as Promise<T>;
  }

  const loadPromise = (async () => {
    const fresh = await fallback();
    await setCache(key, fresh, ttlSeconds);
    return fresh;
  })().finally(() => {
    inFlightCacheLoads.delete(key);
  });

  inFlightCacheLoads.set(key, loadPromise as Promise<unknown>);
  return loadPromise;
}

export const getRedisClient = () => redisCache;
