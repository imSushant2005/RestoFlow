import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { prisma } from './db/prisma';
import { verifyAccessToken } from './utils/jwt';

const WS_PING_INTERVAL_MS = 25_000;
const WS_PING_TIMEOUT_MS = 20_000;
const WS_CONNECT_TIMEOUT_MS = 10_000;
const WS_MAX_HTTP_BUFFER_SIZE = 64 * 1024;
const MAX_TOKEN_LENGTH = 4096;
const MAX_SESSION_TOKEN_LENGTH = 4096;
const MAX_TENANT_SLUG_LENGTH = 200;
const TENANT_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/;

const RATE_LIMIT_BURST = 20;
const RATE_LIMIT_REFILL_PER_SEC = 5;

const TENANT_SLUG_CACHE_TTL_MS = 5 * 60 * 1000;
const TENANT_SLUG_CACHE_MAX = 2000;

type VerifiedAccessToken = {
  userId: string;
  tenantId: string;
};

function isVerifiedAccessToken(value: unknown): value is VerifiedAccessToken {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return typeof v.id === 'string' && v.id.length > 0 && typeof v.tenantId === 'string' && v.tenantId.length > 0;
}

type SocketData = {
  user?: VerifiedAccessToken;
  tenantId?: string;
  sessionToken?: string;
  connectedAt: number;
};

type ClientToServerEvents = {
  'client:ping': (
    payload?: { sentAt?: number },
    ack?: (response: {
      serverTime: string;
      echoedSentAt: number | null;
      latencyHint: number | null;
    }) => void,
  ) => void;

  'sync:request': (
    payload?: unknown,
    ack?: (response: {
      ok: boolean;
      serverTime: string;
      socketId: string;
    }) => void,
  ) => void;
};

type ServerToClientEvents = {
  'socket:ready': (payload: {
    socketId: string;
    serverTime: string;
    tenantId: string | null;
  }) => void;

  'tenant:presence': (payload: {
    tenantId: string;
    connectedClients: number;
    serverTime: string;
  }) => void;

  error: (payload: {
    code: string;
    message?: string;
    event?: string;
  }) => void;
};

type InterServerEvents = Record<string, never>;

type SocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export let io: SocketServer;

export const getTenantRoom = (tenantId: string) => `tenant_${tenantId}`;
export const getSessionRoom = (tenantId: string, sessionToken: string) =>
  `session_${tenantId}_${sessionToken}`;

const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: 'info', message, ...meta, ts: new Date().toISOString() }));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta, ts: new Date().toISOString() }));
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: 'error', message, ...meta, ts: new Date().toISOString() }));
  },
};

class BoundedTTLCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}

const tenantSlugCache = new BoundedTTLCache<string>(
  TENANT_SLUG_CACHE_MAX,
  TENANT_SLUG_CACHE_TTL_MS,
);

type Bucket = {
  tokens: number;
  lastRefillMs: number;
};

class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume(socketId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(socketId);

    if (!bucket) {
      bucket = {
        tokens: RATE_LIMIT_BURST - 1,
        lastRefillMs: now,
      };
      this.buckets.set(socketId, bucket);
      return true;
    }

    const elapsedSec = (now - bucket.lastRefillMs) / 1000;
    const refill = Math.floor(elapsedSec * RATE_LIMIT_REFILL_PER_SEC);

    if (refill > 0) {
      bucket.tokens = Math.min(RATE_LIMIT_BURST, bucket.tokens + refill);
      bucket.lastRefillMs = now;
    }

    if (bucket.tokens < 1) return false;

    bucket.tokens -= 1;
    return true;
  }

  remove(socketId: string): void {
    this.buckets.delete(socketId);
  }
}

const rateLimiter = new TokenBucketRateLimiter();

class PresenceTracker {
  private readonly tenantSockets = new Map<string, Set<string>>();

  add(tenantId: string, socketId: string): number {
    let set = this.tenantSockets.get(tenantId);
    if (!set) {
      set = new Set<string>();
      this.tenantSockets.set(tenantId, set);
    }
    set.add(socketId);
    return set.size;
  }

  remove(tenantId: string, socketId: string): number {
    const set = this.tenantSockets.get(tenantId);
    if (!set) return 0;

    set.delete(socketId);
    if (set.size === 0) {
      this.tenantSockets.delete(tenantId);
      return 0;
    }

    return set.size;
  }

  count(tenantId: string): number {
    return this.tenantSockets.get(tenantId)?.size ?? 0;
  }
}

const presenceTracker = new PresenceTracker();

function nowIso() {
  return new Date().toISOString();
}

function emitTenantPresence(tenantId: string): void {
  io.to(getTenantRoom(tenantId)).emit('tenant:presence', {
    tenantId,
    connectedClients: presenceTracker.count(tenantId),
    serverTime: nowIso(),
  });
}

let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;
let shutdownHooksRegistered = false;

async function setupRedisAdapter(): Promise<void> {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not configured; using in-memory Socket.IO adapter');
    return;
  }

  const redisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    retryStrategy: (attempt: number) => Math.min(500 * 2 ** Math.min(attempt, 4), 10_000),
  } as const;

  const pub = new Redis(process.env.REDIS_URL, redisOptions);
  const sub = pub.duplicate(redisOptions);

  const noop = () => {};
  pub.on('error', noop);
  sub.on('error', noop);

  try {
    await Promise.all([pub.connect(), sub.connect()]);

    pub.off('error', noop);
    sub.off('error', noop);

    pub.on('error', (err) => {
      logger.error('Redis pub client error', { error: err.message });
    });

    sub.on('error', (err) => {
      logger.error('Redis sub client error', { error: err.message });
    });

    io.adapter(createAdapter(pub, sub));
    redisPubClient = pub;
    redisSubClient = sub;

    logger.info('Redis adapter connected');
  } catch (error) {
    pub.off('error', noop);
    sub.off('error', noop);

    logger.warn('Redis unavailable; falling back to in-memory adapter', {
      reason: error instanceof Error ? error.message : String(error),
    });

    try {
      if (pub.status !== 'end') pub.disconnect();
    } catch {}

    try {
      if (sub.status !== 'end') sub.disconnect();
    } catch {}
  }
}

async function resolveTenantIdFromSlug(slug: string): Promise<string | null> {
  const cached = tenantSlugCache.get(slug);
  if (cached) return cached;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!tenant) return null;

  tenantSlugCache.set(slug, tenant.id);
  return tenant.id;
}

function rejectAuth(socket: TypedSocket, next: (err?: Error) => void, reason: string): void {
  logger.warn('Socket auth rejected', {
    socketId: socket.id,
    reason,
    ip: socket.handshake.address,
  });
  next(new Error('Authentication error'));
}

async function authMiddleware(socket: TypedSocket, next: (err?: Error) => void): Promise<void> {
  try {
    const auth = socket.handshake.auth ?? {};

    const rawToken = auth.token;
    if (typeof rawToken === 'string' && rawToken.length > 0 && rawToken.length <= MAX_TOKEN_LENGTH) {
      const decoded = verifyAccessToken(rawToken);

      if (!isVerifiedAccessToken(decoded)) {
        return rejectAuth(socket, next, 'invalid_jwt_claims');
      }

      const verifiedToken: VerifiedAccessToken = {
        userId: decoded.id,
        tenantId: decoded.tenantId,
      };

      const user = await prisma.user.findUnique({
        where: { id: verifiedToken.userId },
        select: { id: true, disabled: true },
      });

      if (!user || user.disabled) {
        return rejectAuth(socket, next, 'user_missing_or_disabled');
      }

      socket.data.user = verifiedToken;
      socket.data.connectedAt = Date.now();
      socket.join(getTenantRoom(verifiedToken.tenantId));
      return next();
    }

    const tenantSlug = auth.tenantSlug;
    const sessionToken = auth.sessionToken;

    if (
      typeof tenantSlug !== 'string' ||
      tenantSlug.length === 0 ||
      tenantSlug.length > MAX_TENANT_SLUG_LENGTH
    ) {
      return rejectAuth(socket, next, 'invalid_tenant_slug');
    }

    if (!TENANT_SLUG_REGEX.test(tenantSlug)) {
      return rejectAuth(socket, next, 'tenant_slug_format_rejected');
    }

    if (
      typeof sessionToken !== 'string' ||
      sessionToken.length === 0 ||
      sessionToken.length > MAX_SESSION_TOKEN_LENGTH
    ) {
      return rejectAuth(socket, next, 'invalid_session_token');
    }

    const tenantId = await resolveTenantIdFromSlug(tenantSlug);
    if (!tenantId) {
      return rejectAuth(socket, next, 'tenant_not_found');
    }

    socket.data.tenantId = tenantId;
    socket.data.sessionToken = sessionToken;
    socket.data.connectedAt = Date.now();
    socket.join(getSessionRoom(tenantId, sessionToken));
    return next();
  } catch (error) {
    logger.error('Auth middleware crashed', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return rejectAuth(socket, next, 'internal_error');
  }
}

function registerHandler(
  socket: TypedSocket,
  event: keyof ClientToServerEvents,
  handler: (payload: any, ack?: any) => void,
): void {
  socket.on(event as any, (payload: any, ack?: any) => {
    if (!rateLimiter.consume(socket.id)) {
      socket.emit('error', {
        code: 'RATE_LIMITED',
        event: String(event),
        message: 'Too many requests',
      });
      return;
    }

    try {
      handler(payload, ack);
    } catch (error) {
      logger.error('Socket handler crashed', {
        socketId: socket.id,
        event: String(event),
        error: error instanceof Error ? error.message : String(error),
      });

      socket.emit('error', {
        code: 'HANDLER_ERROR',
        event: String(event),
      });
    }
  });
}

function onConnection(socket: TypedSocket): void {
  const tenantId = socket.data.user?.tenantId ?? socket.data.tenantId ?? null;
  const isStaff = Boolean(socket.data.user);

  logger.info('Socket connected', {
    socketId: socket.id,
    tenantId,
    isStaff,
    ip: socket.handshake.address,
  });

  if (isStaff && tenantId) {
    presenceTracker.add(tenantId, socket.id);
    emitTenantPresence(tenantId);
  }

  socket.use(([event], next) => {
    if (!['client:ping', 'sync:request'].includes(String(event))) {
      logger.warn('Blocked disallowed socket event', {
        socketId: socket.id,
        event,
      });
      return;
    }
    next();
  });

  socket.emit('socket:ready', {
    socketId: socket.id,
    serverTime: nowIso(),
    tenantId,
  });

  registerHandler(socket, 'client:ping', (payload, ack) => {
    if (typeof ack !== 'function') return;

    const now = Date.now();
    const sentAt =
      typeof payload?.sentAt === 'number' && Number.isFinite(payload.sentAt)
        ? payload.sentAt
        : null;

    ack({
      serverTime: new Date(now).toISOString(),
      echoedSentAt: sentAt,
      latencyHint: sentAt !== null ? Math.max(0, now - sentAt) : null,
    });
  });

  registerHandler(socket, 'sync:request', (_payload, ack) => {
    if (typeof ack !== 'function') return;

    ack({
      ok: true,
      serverTime: nowIso(),
      socketId: socket.id,
    });
  });

  socket.on('disconnect', (reason) => {
    if (isStaff && tenantId) {
      presenceTracker.remove(tenantId, socket.id);
      emitTenantPresence(tenantId);
    }

    rateLimiter.remove(socket.id);

    logger.info('Socket disconnected', {
      socketId: socket.id,
      tenantId,
      reason,
    });
  });
}

function buildAllowedOrigins(): string[] {
  return [...new Set(
    (process.env.WS_ORIGINS ?? process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  )];
}

function registerShutdownHooks(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const shutdown = async () => {
    try {
      io?.close();
    } catch {}

    try {
      if (redisPubClient && redisPubClient.status !== 'end') {
        redisPubClient.disconnect();
      }
    } catch {}

    try {
      if (redisSubClient && redisSubClient.status !== 'end') {
        redisSubClient.disconnect();
      }
    } catch {}
  };

  process.once('SIGINT', () => {
    void shutdown();
  });

  process.once('SIGTERM', () => {
    void shutdown();
  });
}

export async function initSocket(server: HttpServer): Promise<SocketServer> {
  const allowedOrigins = buildAllowedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin) {
          if (isProduction && allowedOrigins.length > 0) {
            return callback(new Error('Origin required'));
          }
          return callback(null, true);
        }

        if (allowedOrigins.length === 0) {
          return callback(new Error('No allowed origins configured'));
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Origin not allowed'));
      },
      credentials: true,
    },
    cookie: false,
    perMessageDeflate: false,
    pingInterval: WS_PING_INTERVAL_MS,
    pingTimeout: WS_PING_TIMEOUT_MS,
    connectTimeout: WS_CONNECT_TIMEOUT_MS,
    maxHttpBufferSize: WS_MAX_HTTP_BUFFER_SIZE,
    transports: ['websocket', 'polling'],
    allowEIO3: false,
    serveClient: false,
  });

  await setupRedisAdapter();

  io.use(authMiddleware);
  io.on('connection', onConnection);

  registerShutdownHooks();

  logger.info('Socket.IO initialized', {
    redisEnabled: Boolean(process.env.REDIS_URL),
    origins: allowedOrigins,
    maxHttpBufferSize: WS_MAX_HTTP_BUFFER_SIZE,
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return io;
}