import type { Request } from 'express';
import { getRedisClient } from './cache.service';
import { logger } from '../utils/logger';

const AUTH_WINDOW_SECONDS = 15 * 60;
const SUSPICIOUS_THRESHOLD = 5;

type MemoryCounter = {
  count: number;
  expiresAt: number;
};

type AuthFailureScope = 'login' | 'forgot_password' | 'refresh';

const memoryCounters = new Map<string, MemoryCounter>();

function normalizeSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9@._:-]+/gi, '_').slice(0, 120) || 'unknown';
}

function getClientIp(req: Request) {
  return (
    req.ip ||
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : '') ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function buildKeys(scope: AuthFailureScope, identifier: string, ip: string) {
  const id = normalizeSegment(identifier || 'unknown');
  const normalizedIp = normalizeSegment(ip || 'unknown');
  return {
    identifierKey: `auth_fail:${scope}:identifier:${id}`,
    ipKey: `auth_fail:${scope}:ip:${normalizedIp}`,
  };
}

function getMemoryCount(key: string) {
  const entry = memoryCounters.get(key);
  if (!entry) return 0;
  if (Date.now() > entry.expiresAt) {
    memoryCounters.delete(key);
    return 0;
  }
  return entry.count;
}

function incrementMemoryCount(key: string) {
  const next = getMemoryCount(key) + 1;
  memoryCounters.set(key, {
    count: next,
    expiresAt: Date.now() + AUTH_WINDOW_SECONDS * 1000,
  });
  return next;
}

function clearMemoryCount(key: string) {
  memoryCounters.delete(key);
}

async function incrementCounter(key: string) {
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, AUTH_WINDOW_SECONDS);
    }
    return count;
  }

  return incrementMemoryCount(key);
}

async function clearCounter(key: string) {
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    await redis.del(key);
    return;
  }

  clearMemoryCount(key);
}

export async function recordFailedAuthAttempt(input: {
  req: Request;
  scope: AuthFailureScope;
  identifier: string;
  reason: string;
}) {
  const ip = getClientIp(input.req);
  const userAgent = String(input.req.get('user-agent') || '').slice(0, 240);
  const keys = buildKeys(input.scope, input.identifier, ip);

  const [identifierCount, ipCount] = await Promise.all([
    incrementCounter(keys.identifierKey),
    incrementCounter(keys.ipKey),
  ]);

  const maxCount = Math.max(identifierCount, ipCount);
  const meta = {
    scope: input.scope,
    identifier: normalizeSegment(input.identifier || 'unknown'),
    ip,
    reason: input.reason,
    identifierCount,
    ipCount,
    userAgent,
  };

  if (maxCount >= SUSPICIOUS_THRESHOLD) {
    logger.warn(meta, 'Suspicious authentication activity detected');
  } else {
    logger.info(meta, 'Authentication failure recorded');
  }

  return {
    identifierCount,
    ipCount,
    suspicious: maxCount >= SUSPICIOUS_THRESHOLD,
  };
}

export async function clearFailedAuthAttempts(input: {
  req: Request;
  scope: AuthFailureScope;
  identifier: string;
}) {
  const ip = getClientIp(input.req);
  const keys = buildKeys(input.scope, input.identifier, ip);
  await Promise.all([clearCounter(keys.identifierKey), clearCounter(keys.ipKey)]);
}

export function getRequestSecurityMeta(req: Request) {
  return {
    ip: getClientIp(req),
    userAgent: String(req.get('user-agent') || '').slice(0, 240),
  };
}
