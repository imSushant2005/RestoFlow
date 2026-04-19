import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { UserRole } from '@dineflow/prisma';
import { prisma, withPrismaRetry } from './db/prisma';
import { env } from './config/env';
import { verifyAccessToken } from './utils/jwt';
import { verifySessionAccessToken } from './utils/public-access';

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
  role?: UserRole;
};

function isVerifiedAccessToken(value: unknown): value is VerifiedAccessToken {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  const userId = typeof v.userId === 'string' ? v.userId : typeof v.id === 'string' ? v.id : '';
  return userId.length > 0 && typeof v.tenantId === 'string' && v.tenantId.length > 0;
}

type SocketData = {
  user?: VerifiedAccessToken;
  tenantId?: string;
  sessionId?: string;
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
  [event: string]: (...args: any[]) => void;

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

  'menu:availability_changed': (payload: {
    itemId: string;
    isAvailable: boolean;
  }) => void;

  'order:update': (payload: any) => void;

  'order:new': (payload: any) => void;

  'session:new': (payload: {
    id: string;
    tableId: string | null;
    tableName?: string;
    customerName?: string;
    partySize: number;
    openedAt: Date;
  }) => void;

  'session:update': (payload: {
    sessionId: string;
    status: string;
    updatedAt: string;
  }) => void;

  'session:finished': (payload: {
    sessionId: string;
    tableName?: string;
    totalAmount?: number;
  }) => void;

  'session:completed': (payload: {
    sessionId: string;
    paymentMethod: string;
    closedAt: string | Date;
  }) => void;

  'orders:bulk_status': (payload: {
    sessionId: string;
    status: string;
    updatedAt: string;
  }) => void;

  'table:status_change': (payload: {
    tableId: string;
    status: string;
    orderNumber?: string;
  }) => void;

  'waiter:call': (payload: {
    tableId?: string;
    tableName: string;
    type: string;
    sessionId?: string | null;
    timestamp: string;
  }) => void;

  'waiter:acknowledged': (payload: {
    sessionId?: string;
    tableId?: string;
    status: 'ACCEPTED';
    timestamp: string;
  }) => void;

  'waiter:pickup_ready': (payload: {
    orderId: string;
    orderNumber: string;
    tableName: string | null;
    zoneName: string | null;
    destinationLabel: string;
    orderType: string;
    itemCount: number;
    readyAt: string | Date;
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
export const getRoleRoom = (tenantId: string, role: string) =>
  `tenant_${tenantId}_role_${String(role || 'unknown').toUpperCase()}`;
export const getSessionRoom = (tenantId: string, sessionToken: string) =>
  `session_${tenantId}_${sessionToken}`;

const socketMetrics = {
  activeConnections: 0,
  totalConnections: 0,
  rejectedAuthCount: 0,
  handledEventCount: 0,
  rateLimitedEventCount: 0,
  redisAdapterEnabled: false,
  lastConnectionAt: null as string | null,
  lastDisconnectAt: null as string | null,
};

export function getSocketMetrics() {
  return { ...socketMetrics };
}

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

// Cache validated user IDs for 5 minutes to prevent DB hit on every reconnect
const socketUserAuthCache = new BoundedTTLCache<boolean>(10_000, 5 * 60 * 1000);
const socketSessionAuthCache = new BoundedTTLCache<boolean>(20_000, 20 * 1000);

// Debounce presence broadcasts per tenant to prevent reconnect-storm fan-out
const presenceDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emitTenantPresenceDebounced(tenantId: string): void {
  const existing = presenceDebounceTimers.get(tenantId);
  if (existing) clearTimeout(existing);
  presenceDebounceTimers.set(
    tenantId,
    setTimeout(() => {
      presenceDebounceTimers.delete(tenantId);
      emitTenantPresence(tenantId);
    }, 300),
  );
}

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
  if (!env.REDIS_URL) {
    logger.warn('REDIS_URL not configured; using in-memory Socket.IO adapter');
    return;
  }

  const redisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    retryStrategy: (attempt: number) => Math.min(500 * 2 ** Math.min(attempt, 4), 10_000),
  } as const;

  const pub = new Redis(env.REDIS_URL, redisOptions);
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

  const tenant = await withPrismaRetry(
    () =>
      prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      }),
    'resolve-tenant-id-from-slug',
  );

  if (!tenant) return null;

  tenantSlugCache.set(slug, tenant.id);
  return tenant.id;
}

function rejectAuth(socket: TypedSocket, next: (err?: Error) => void, reason: string): void {
  socketMetrics.rejectedAuthCount += 1;
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
      let decoded;
      try {
        decoded = verifyAccessToken(rawToken);
      } catch (err: any) {
        const name = err && err.name ? String(err.name) : 'UnknownError';
        // Distinguish expired tokens from other JWT errors so clients can refresh tokens.
        if (name === 'TokenExpiredError') {
          return rejectAuth(socket, next, 'jwt_expired');
        }
        return rejectAuth(socket, next, 'invalid_jwt');
      }

      if (!isVerifiedAccessToken(decoded)) {
        return rejectAuth(socket, next, 'invalid_jwt_claims');
      }

      const verifiedToken: VerifiedAccessToken = {
        userId: decoded.id,
        tenantId: decoded.tenantId,
        role: decoded.role,
      };

      const cacheKey = `auth_user_${verifiedToken.userId}`;
      const isCached = socketUserAuthCache.get(cacheKey);

      if (!isCached) {
        const user = await withPrismaRetry(
          () =>
            prisma.user.findUnique({
              where: { id: verifiedToken.userId },
              select: { id: true, isActive: true },
            }),
          'auth-user-lookup',
        );

        if (!user || !user.isActive) {
          return rejectAuth(socket, next, 'user_missing_or_inactive');
        }

        socketUserAuthCache.set(cacheKey, true);
      }

      socket.data.user = verifiedToken;
      socket.data.connectedAt = Date.now();
      socket.join(getTenantRoom(verifiedToken.tenantId));
      if (verifiedToken.role) {
        socket.join(getRoleRoom(verifiedToken.tenantId, verifiedToken.role));
      }
      return next();
    }

    const tenantSlug = auth.tenantSlug;
    const sessionAccessToken = auth.sessionAccessToken;

    if (
      typeof sessionAccessToken !== 'string' ||
      sessionAccessToken.length === 0 ||
      sessionAccessToken.length > MAX_SESSION_TOKEN_LENGTH
    ) {
      return rejectAuth(socket, next, 'invalid_session_access_token');
    }

    let verifiedSession;
    try {
      verifiedSession = verifySessionAccessToken(sessionAccessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('expired')) {
        return rejectAuth(socket, next, 'session_access_expired');
      }
      return rejectAuth(socket, next, 'invalid_session_access_token');
    }

    if (typeof tenantSlug === 'string' && tenantSlug.trim().length > 0) {
      if (tenantSlug.length > MAX_TENANT_SLUG_LENGTH) {
        return rejectAuth(socket, next, 'invalid_tenant_slug');
      }
      if (!TENANT_SLUG_REGEX.test(tenantSlug)) {
        return rejectAuth(socket, next, 'tenant_slug_format_rejected');
      }

      const tenantIdFromSlug = await resolveTenantIdFromSlug(tenantSlug);
      if (!tenantIdFromSlug) {
        return rejectAuth(socket, next, 'tenant_not_found');
      }
      if (tenantIdFromSlug !== verifiedSession.tenantId) {
        return rejectAuth(socket, next, 'session_tenant_mismatch');
      }
    }

    const sessionCacheKey = `auth_session_${verifiedSession.tenantId}_${verifiedSession.sessionId}_${verifiedSession.customerId}`;
    const isCachedSession = socketSessionAuthCache.get(sessionCacheKey);

    if (!isCachedSession) {
      const session = await withPrismaRetry(
        () =>
          prisma.diningSession.findFirst({
            where: {
              id: verifiedSession.sessionId,
              tenantId: verifiedSession.tenantId,
              customerId: verifiedSession.customerId,
            },
            select: { id: true },
          }),
        'auth-session-lookup',
      );

      if (!session) {
        return rejectAuth(socket, next, 'session_missing_or_revoked');
      }

      socketSessionAuthCache.set(sessionCacheKey, true);
    }

    socket.data.tenantId = verifiedSession.tenantId;
    socket.data.sessionId = verifiedSession.sessionId;
    socket.data.connectedAt = Date.now();
    socket.join(getSessionRoom(verifiedSession.tenantId, verifiedSession.sessionId));
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
      socketMetrics.rateLimitedEventCount += 1;
      socket.emit('error', {
        code: 'RATE_LIMITED',
        event: String(event),
        message: 'Too many requests',
      });
      return;
    }

    try {
      socketMetrics.handledEventCount += 1;
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
    emitTenantPresenceDebounced(tenantId);
  }

  socketMetrics.activeConnections += 1;
  socketMetrics.totalConnections += 1;
  socketMetrics.lastConnectionAt = nowIso();

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
      emitTenantPresenceDebounced(tenantId);
    }

    rateLimiter.remove(socket.id);
    socketMetrics.activeConnections = Math.max(0, socketMetrics.activeConnections - 1);
    socketMetrics.lastDisconnectAt = nowIso();

    logger.info('Socket disconnected', {
      socketId: socket.id,
      tenantId,
      reason,
    });
  });
}

function buildAllowedOrigins(): string[] {
  const origins = [...env.ALLOWED_ORIGINS];

  // In development, if no origins are set, allow common local dev ports
  if (origins.length === 0 && env.NODE_ENV !== 'production') {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
    ];
  }

  return origins;
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
  const isProduction = env.NODE_ENV === 'production';

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
    connectionStateRecovery: {
      // 30s: long enough for a network blip, short enough to prevent ghost sessions on expired JWTs
      maxDisconnectionDuration: 30 * 1000,
      // MUST be false: auth middleware must re-validate token on every reconnect
      skipMiddlewares: false,
    },
  });

  await setupRedisAdapter();
  socketMetrics.redisAdapterEnabled = Boolean(redisPubClient && redisSubClient);

  if (isProduction && env.REQUIRE_REDIS_FOR_PROD && !socketMetrics.redisAdapterEnabled) {
    logger.error('Redis adapter required for production but not available');
    throw new Error('Redis adapter required for production');
  }

  io.use(authMiddleware);
  io.on('connection', onConnection);
  io.engine.on('connection_error', (err) => {
    logger.warn('Socket engine connection error', {
      code: err.code,
      message: err.message,
    });
  });

  registerShutdownHooks();

  logger.info('Socket.IO initialized', {
    redisEnabled: Boolean(env.REDIS_URL),
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
