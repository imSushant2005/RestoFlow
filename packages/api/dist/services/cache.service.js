"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCache = exports.setCache = exports.getCache = void 0;
exports.withCache = withCache;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const memoryCache = new Map();
const isProduction = process.env.NODE_ENV === 'production';
const shouldUseRedis = Boolean(env_1.env.REDIS_URL);
const redisCache = shouldUseRedis
    ? new ioredis_1.default(env_1.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
        connectTimeout: 3000,
    })
    : null;
let hasLoggedRedisDisconnect = false;
let redisReady = false;
let redisConnectPromise = null;
let redisRetryAfterMs = 0;
if (redisCache) {
    redisCache.on('error', (err) => {
        redisReady = false;
        if (!hasLoggedRedisDisconnect) {
            hasLoggedRedisDisconnect = true;
            logger_1.logger.error({ err }, 'Redis Cache Service Disconnected');
        }
    });
    redisCache.on('connect', () => {
        redisReady = true;
        hasLoggedRedisDisconnect = false;
        logger_1.logger.info('Redis Cache Service Connected');
    });
    redisCache.on('close', () => {
        redisReady = false;
    });
}
else {
    logger_1.logger.warn('REDIS_URL not configured. Using in-memory cache.');
}
function logCacheError(meta, message) {
    if (isProduction) {
        logger_1.logger.error(meta, message);
    }
    else {
        console.warn(`[CACHE_DEBUG] ${message}`, meta);
    }
}
function setMemoryValue(key, value, ttlSeconds) {
    memoryCache.set(key, {
        value: JSON.stringify(value),
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}
function getMemoryValue(key) {
    const entry = memoryCache.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return JSON.parse(entry.value);
}
function deleteMemoryValue(pattern) {
    for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace(/\*/g, ''))) {
            memoryCache.delete(key);
        }
    }
}
async function ensureRedisConnection() {
    if (!redisCache)
        return false;
    if (redisReady)
        return true;
    if (Date.now() < redisRetryAfterMs)
        return false;
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
            }
            catch { }
        })
            .finally(() => {
            redisConnectPromise = null;
        });
    }
    await redisConnectPromise;
    return redisReady;
}
const getCache = async (key) => {
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
    }
    catch (error) {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 5_000;
        logCacheError({ key, error }, 'Cache Get Failed');
        return getMemoryValue(key);
    }
};
exports.getCache = getCache;
const setCache = async (key, value, ttlSeconds = 3600) => {
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
    }
    catch (error) {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 5_000;
        logCacheError({ key, error }, 'Cache Set Failed');
        setMemoryValue(key, value, ttlSeconds);
    }
};
exports.setCache = setCache;
const deleteCache = async (pattern) => {
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
        }
        else {
            await redisCache.del(pattern);
        }
    }
    catch (error) {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 5_000;
        logCacheError({ pattern, error }, 'Cache Delete Failed');
        deleteMemoryValue(pattern);
    }
};
exports.deleteCache = deleteCache;
/**
 * Executes a fallback function if cache miss, otherwise returns cached value.
 */
async function withCache(key, fallback, ttlSeconds = 3600) {
    const cached = await (0, exports.getCache)(key);
    if (cached !== null) {
        return cached;
    }
    const fresh = await fallback();
    await (0, exports.setCache)(key, fresh, ttlSeconds);
    return fresh;
}
//# sourceMappingURL=cache.service.js.map