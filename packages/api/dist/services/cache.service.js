"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = exports.deleteCache = exports.setCache = exports.getCache = void 0;
exports.withCache = withCache;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const runtime_metrics_service_1 = require("./runtime-metrics.service");
const memoryCache = new Map();
const inFlightCacheLoads = new Map();
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
    (0, runtime_metrics_service_1.setRedisState)('connecting');
    redisCache.on('error', (err) => {
        redisReady = false;
        (0, runtime_metrics_service_1.recordRedisFailure)(err);
        if (!hasLoggedRedisDisconnect) {
            hasLoggedRedisDisconnect = true;
            logger_1.logger.error({ err }, 'Redis Cache Service Disconnected');
        }
    });
    redisCache.on('connect', () => {
        redisReady = false;
        (0, runtime_metrics_service_1.setRedisState)('connecting');
    });
    redisCache.on('ready', () => {
        redisReady = true;
        (0, runtime_metrics_service_1.setRedisState)('ready');
        hasLoggedRedisDisconnect = false;
        logger_1.logger.info('Redis Cache Service Ready');
    });
    redisCache.on('close', () => {
        redisReady = false;
        (0, runtime_metrics_service_1.setRedisState)('unavailable');
    });
}
else {
    (0, runtime_metrics_service_1.setRedisState)('not_configured');
    logger_1.logger.warn('REDIS_URL not configured. Using in-memory cache.');
}
function logCacheError(meta, message) {
    (0, runtime_metrics_service_1.recordCacheError)(meta.error);
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
function shouldUseMemoryFallback() {
    return !shouldUseRedis || !isProduction;
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
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function deleteMemoryValue(pattern) {
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
    if (!redisCache)
        return false;
    if (isRedisCommandReady())
        return true;
    if (Date.now() < redisRetryAfterMs)
        return false;
    if (!redisConnectPromise) {
        redisConnectPromise = redisCache
            .connect()
            .then(() => {
            redisReady = redisCache.status === 'ready';
        })
            .catch((error) => {
            redisReady = false;
            redisRetryAfterMs = Date.now() + 30_000;
            logCacheError({ error, fallback: shouldUseMemoryFallback() ? 'memory' : 'cache_bypass' }, 'Redis unavailable during cache connect');
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
    return isRedisCommandReady();
}
const getCache = async (key) => {
    try {
        if (!redisCache) {
            const memoryValue = getMemoryValue(key);
            (0, runtime_metrics_service_1.recordCacheRead)(memoryValue !== null, 'memory');
            return memoryValue;
        }
        const canUseRedis = await ensureRedisConnection();
        if (!canUseRedis) {
            if (shouldUseMemoryFallback()) {
                const memoryValue = getMemoryValue(key);
                (0, runtime_metrics_service_1.recordCacheRead)(memoryValue !== null, 'memory');
                return memoryValue;
            }
            (0, runtime_metrics_service_1.recordCacheRead)(false, 'bypass');
            return null;
        }
        if (!isRedisCommandReady()) {
            redisReady = false;
            (0, runtime_metrics_service_1.setRedisState)('unavailable');
            if (shouldUseMemoryFallback()) {
                const memoryValue = getMemoryValue(key);
                (0, runtime_metrics_service_1.recordCacheRead)(memoryValue !== null, 'memory');
                return memoryValue;
            }
            (0, runtime_metrics_service_1.recordCacheRead)(false, 'bypass');
            return null;
        }
        const data = await redisCache.get(key);
        (0, runtime_metrics_service_1.recordCacheRead)(Boolean(data), 'redis');
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 5_000;
        logCacheError({ key, error }, 'Cache Get Failed');
        if (shouldUseMemoryFallback()) {
            const memoryValue = getMemoryValue(key);
            (0, runtime_metrics_service_1.recordCacheRead)(memoryValue !== null, 'memory');
            return memoryValue;
        }
        (0, runtime_metrics_service_1.recordCacheRead)(false, 'bypass');
        return null;
    }
};
exports.getCache = getCache;
const setCache = async (key, value, ttlSeconds = 3600) => {
    try {
        if (!redisCache) {
            setMemoryValue(key, value, ttlSeconds);
            (0, runtime_metrics_service_1.recordCacheWrite)('memory');
            return;
        }
        const canUseRedis = await ensureRedisConnection();
        if (!canUseRedis) {
            if (shouldUseMemoryFallback()) {
                setMemoryValue(key, value, ttlSeconds);
                (0, runtime_metrics_service_1.recordCacheWrite)('memory');
            }
            else {
                (0, runtime_metrics_service_1.recordCacheWrite)('bypass');
            }
            return;
        }
        if (!isRedisCommandReady()) {
            redisReady = false;
            (0, runtime_metrics_service_1.setRedisState)('unavailable');
            if (shouldUseMemoryFallback()) {
                setMemoryValue(key, value, ttlSeconds);
                (0, runtime_metrics_service_1.recordCacheWrite)('memory');
            }
            else {
                (0, runtime_metrics_service_1.recordCacheWrite)('bypass');
            }
            return;
        }
        await redisCache.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        (0, runtime_metrics_service_1.recordCacheWrite)('redis');
    }
    catch (error) {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 5_000;
        logCacheError({ key, error }, 'Cache Set Failed');
        if (shouldUseMemoryFallback()) {
            setMemoryValue(key, value, ttlSeconds);
            (0, runtime_metrics_service_1.recordCacheWrite)('memory');
        }
        else {
            (0, runtime_metrics_service_1.recordCacheWrite)('bypass');
        }
    }
};
exports.setCache = setCache;
const deleteCache = async (pattern) => {
    try {
        if (!redisCache) {
            deleteMemoryValue(pattern);
            (0, runtime_metrics_service_1.recordCacheDelete)();
            return;
        }
        const canUseRedis = await ensureRedisConnection();
        if (!canUseRedis) {
            if (shouldUseMemoryFallback()) {
                deleteMemoryValue(pattern);
            }
            (0, runtime_metrics_service_1.recordCacheDelete)();
            return;
        }
        if (!isRedisCommandReady()) {
            redisReady = false;
            (0, runtime_metrics_service_1.setRedisState)('unavailable');
            if (shouldUseMemoryFallback()) {
                deleteMemoryValue(pattern);
            }
            (0, runtime_metrics_service_1.recordCacheDelete)();
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
        }
        else {
            await redisCache.del(pattern);
        }
        (0, runtime_metrics_service_1.recordCacheDelete)();
    }
    catch (error) {
        redisReady = false;
        redisRetryAfterMs = Date.now() + 5_000;
        logCacheError({ pattern, error }, 'Cache Delete Failed');
        if (shouldUseMemoryFallback()) {
            deleteMemoryValue(pattern);
        }
        (0, runtime_metrics_service_1.recordCacheDelete)();
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
    const existingLoad = inFlightCacheLoads.get(key);
    if (existingLoad) {
        return existingLoad;
    }
    const loadPromise = (async () => {
        const fresh = await fallback();
        await (0, exports.setCache)(key, fresh, ttlSeconds);
        return fresh;
    })().finally(() => {
        inFlightCacheLoads.delete(key);
    });
    inFlightCacheLoads.set(key, loadPromise);
    return loadPromise;
}
const getRedisClient = () => redisCache;
exports.getRedisClient = getRedisClient;
//# sourceMappingURL=cache.service.js.map