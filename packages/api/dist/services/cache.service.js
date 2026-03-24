"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCache = exports.setCache = exports.getCache = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const memoryCache = new Map();
const isProduction = process.env.NODE_ENV === 'production';
const shouldUseRedis = Boolean(env_1.env.REDIS_URL) && isProduction;
const redisCache = shouldUseRedis
    ? new ioredis_1.default(env_1.env.REDIS_URL, {
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
            logger_1.logger.error({ err }, 'Redis Cache Service Disconnected');
        }
    });
}
else {
    if (!env_1.env.REDIS_URL && isProduction) {
        logger_1.logger.warn('REDIS_URL not configured. Falling back to in-memory cache.');
    }
}
function logCacheError(meta, message) {
    if (isProduction) {
        logger_1.logger.error(meta, message);
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
const getCache = async (key) => {
    try {
        if (!redisCache) {
            return getMemoryValue(key);
        }
        const data = await redisCache.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
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
        await redisCache.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
    catch (error) {
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
        const keys = await redisCache.keys(pattern);
        if (keys.length > 0) {
            await redisCache.del(...keys);
        }
    }
    catch (error) {
        logCacheError({ pattern, error }, 'Cache Delete Failed');
        deleteMemoryValue(pattern);
    }
};
exports.deleteCache = deleteCache;
//# sourceMappingURL=cache.service.js.map