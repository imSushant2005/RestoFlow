"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionRoom = exports.getTenantRoom = exports.io = void 0;
exports.initSocket = initSocket;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma_1 = require("./db/prisma");
const env_1 = require("./config/env");
const jwt_1 = require("./utils/jwt");
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
function isVerifiedAccessToken(value) {
    if (!value || typeof value !== 'object')
        return false;
    const v = value;
    return typeof v.id === 'string' && v.id.length > 0 && typeof v.tenantId === 'string' && v.tenantId.length > 0;
}
const getTenantRoom = (tenantId) => `tenant_${tenantId}`;
exports.getTenantRoom = getTenantRoom;
const getSessionRoom = (tenantId, sessionToken) => `session_${tenantId}_${sessionToken}`;
exports.getSessionRoom = getSessionRoom;
const logger = {
    info(message, meta) {
        console.log(JSON.stringify({ level: 'info', message, ...meta, ts: new Date().toISOString() }));
    },
    warn(message, meta) {
        console.warn(JSON.stringify({ level: 'warn', message, ...meta, ts: new Date().toISOString() }));
    },
    error(message, meta) {
        console.error(JSON.stringify({ level: 'error', message, ...meta, ts: new Date().toISOString() }));
    },
};
class BoundedTTLCache {
    maxEntries;
    ttlMs;
    store = new Map();
    constructor(maxEntries, ttlMs) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value) {
        if (this.store.size >= this.maxEntries) {
            const oldestKey = this.store.keys().next().value;
            if (oldestKey)
                this.store.delete(oldestKey);
        }
        this.store.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs,
        });
    }
}
const tenantSlugCache = new BoundedTTLCache(TENANT_SLUG_CACHE_MAX, TENANT_SLUG_CACHE_TTL_MS);
class TokenBucketRateLimiter {
    buckets = new Map();
    consume(socketId) {
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
        if (bucket.tokens < 1)
            return false;
        bucket.tokens -= 1;
        return true;
    }
    remove(socketId) {
        this.buckets.delete(socketId);
    }
}
const rateLimiter = new TokenBucketRateLimiter();
class PresenceTracker {
    tenantSockets = new Map();
    add(tenantId, socketId) {
        let set = this.tenantSockets.get(tenantId);
        if (!set) {
            set = new Set();
            this.tenantSockets.set(tenantId, set);
        }
        set.add(socketId);
        return set.size;
    }
    remove(tenantId, socketId) {
        const set = this.tenantSockets.get(tenantId);
        if (!set)
            return 0;
        set.delete(socketId);
        if (set.size === 0) {
            this.tenantSockets.delete(tenantId);
            return 0;
        }
        return set.size;
    }
    count(tenantId) {
        return this.tenantSockets.get(tenantId)?.size ?? 0;
    }
}
const presenceTracker = new PresenceTracker();
function nowIso() {
    return new Date().toISOString();
}
function emitTenantPresence(tenantId) {
    exports.io.to((0, exports.getTenantRoom)(tenantId)).emit('tenant:presence', {
        tenantId,
        connectedClients: presenceTracker.count(tenantId),
        serverTime: nowIso(),
    });
}
let redisPubClient = null;
let redisSubClient = null;
let shutdownHooksRegistered = false;
async function setupRedisAdapter() {
    if (!env_1.env.REDIS_URL) {
        logger.warn('REDIS_URL not configured; using in-memory Socket.IO adapter');
        return;
    }
    const redisOptions = {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        retryStrategy: (attempt) => Math.min(500 * 2 ** Math.min(attempt, 4), 10_000),
    };
    const pub = new ioredis_1.default(env_1.env.REDIS_URL, redisOptions);
    const sub = pub.duplicate(redisOptions);
    const noop = () => { };
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
        exports.io.adapter((0, redis_adapter_1.createAdapter)(pub, sub));
        redisPubClient = pub;
        redisSubClient = sub;
        logger.info('Redis adapter connected');
    }
    catch (error) {
        pub.off('error', noop);
        sub.off('error', noop);
        logger.warn('Redis unavailable; falling back to in-memory adapter', {
            reason: error instanceof Error ? error.message : String(error),
        });
        try {
            if (pub.status !== 'end')
                pub.disconnect();
        }
        catch { }
        try {
            if (sub.status !== 'end')
                sub.disconnect();
        }
        catch { }
    }
}
async function resolveTenantIdFromSlug(slug) {
    const cached = tenantSlugCache.get(slug);
    if (cached)
        return cached;
    const tenant = await prisma_1.prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
    });
    if (!tenant)
        return null;
    tenantSlugCache.set(slug, tenant.id);
    return tenant.id;
}
function rejectAuth(socket, next, reason) {
    logger.warn('Socket auth rejected', {
        socketId: socket.id,
        reason,
        ip: socket.handshake.address,
    });
    next(new Error('Authentication error'));
}
async function authMiddleware(socket, next) {
    try {
        const auth = socket.handshake.auth ?? {};
        const rawToken = auth.token;
        if (typeof rawToken === 'string' && rawToken.length > 0 && rawToken.length <= MAX_TOKEN_LENGTH) {
            const decoded = (0, jwt_1.verifyAccessToken)(rawToken);
            if (!isVerifiedAccessToken(decoded)) {
                return rejectAuth(socket, next, 'invalid_jwt_claims');
            }
            const verifiedToken = {
                userId: decoded.id,
                tenantId: decoded.tenantId,
            };
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: verifiedToken.userId },
                select: { id: true, isActive: true },
            });
            if (!user || !user.isActive) {
                return rejectAuth(socket, next, 'user_missing_or_inactive');
            }
            socket.data.user = verifiedToken;
            socket.data.connectedAt = Date.now();
            const staffRoom = (0, exports.getTenantRoom)(verifiedToken.tenantId);
            socket.join(staffRoom);
            console.log(`[DEBUG_SOCKET] Staff authenticated & joined room: ${staffRoom} (Socket: ${socket.id}, User: ${verifiedToken.userId})`);
            return next();
        }
        const tenantSlug = auth.tenantSlug;
        const sessionToken = auth.sessionToken;
        if (typeof tenantSlug !== 'string' ||
            tenantSlug.length === 0 ||
            tenantSlug.length > MAX_TENANT_SLUG_LENGTH) {
            return rejectAuth(socket, next, 'invalid_tenant_slug');
        }
        if (!TENANT_SLUG_REGEX.test(tenantSlug)) {
            return rejectAuth(socket, next, 'tenant_slug_format_rejected');
        }
        if (typeof sessionToken !== 'string' ||
            sessionToken.length === 0 ||
            sessionToken.length > MAX_SESSION_TOKEN_LENGTH) {
            return rejectAuth(socket, next, 'invalid_session_token');
        }
        const tenantId = await resolveTenantIdFromSlug(tenantSlug);
        if (!tenantId) {
            return rejectAuth(socket, next, 'tenant_not_found');
        }
        socket.data.tenantId = tenantId;
        socket.data.sessionToken = sessionToken;
        socket.data.connectedAt = Date.now();
        socket.join((0, exports.getSessionRoom)(tenantId, sessionToken));
        return next();
    }
    catch (error) {
        logger.error('Auth middleware crashed', {
            socketId: socket.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return rejectAuth(socket, next, 'internal_error');
    }
}
function registerHandler(socket, event, handler) {
    socket.on(event, (payload, ack) => {
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
        }
        catch (error) {
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
function onConnection(socket) {
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
        if (typeof ack !== 'function')
            return;
        const now = Date.now();
        const sentAt = typeof payload?.sentAt === 'number' && Number.isFinite(payload.sentAt)
            ? payload.sentAt
            : null;
        ack({
            serverTime: new Date(now).toISOString(),
            echoedSentAt: sentAt,
            latencyHint: sentAt !== null ? Math.max(0, now - sentAt) : null,
        });
    });
    registerHandler(socket, 'sync:request', (_payload, ack) => {
        if (typeof ack !== 'function')
            return;
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
function buildAllowedOrigins() {
    const envOrigins = (process.env.WS_ORIGINS ?? process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    const clientUrl = process.env.CLIENT_URL || '';
    const origins = [...new Set([...envOrigins, clientUrl])].filter(Boolean);
    // In development, if no origins are set, allow common local dev ports
    if (origins.length === 0 && process.env.NODE_ENV !== 'production') {
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
function registerShutdownHooks() {
    if (shutdownHooksRegistered)
        return;
    shutdownHooksRegistered = true;
    const shutdown = async () => {
        try {
            exports.io?.close();
        }
        catch { }
        try {
            if (redisPubClient && redisPubClient.status !== 'end') {
                redisPubClient.disconnect();
            }
        }
        catch { }
        try {
            if (redisSubClient && redisSubClient.status !== 'end') {
                redisSubClient.disconnect();
            }
        }
        catch { }
    };
    process.once('SIGINT', () => {
        void shutdown();
    });
    process.once('SIGTERM', () => {
        void shutdown();
    });
}
async function initSocket(server) {
    const allowedOrigins = buildAllowedOrigins();
    const isProduction = process.env.NODE_ENV === 'production';
    exports.io = new socket_io_1.Server(server, {
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
    exports.io.use(authMiddleware);
    exports.io.on('connection', onConnection);
    registerShutdownHooks();
    logger.info('Socket.IO initialized', {
        redisEnabled: Boolean(process.env.REDIS_URL),
        origins: allowedOrigins,
        maxHttpBufferSize: WS_MAX_HTTP_BUFFER_SIZE,
    });
    return exports.io;
}
function getIO() {
    if (!exports.io) {
        throw new Error('Socket.IO not initialized. Call initSocket() first.');
    }
    return exports.io;
}
//# sourceMappingURL=socket.js.map