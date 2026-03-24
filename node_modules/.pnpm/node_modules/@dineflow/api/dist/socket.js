"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = exports.getSessionRoom = exports.getTenantRoom = exports.io = void 0;
const socket_io_1 = require("socket.io");
const jwt_1 = require("./utils/jwt");
const prisma_1 = require("./db/prisma");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
const getTenantRoom = (tenantId) => `tenant_${tenantId}`;
exports.getTenantRoom = getTenantRoom;
const getSessionRoom = (tenantId, sessionToken) => `session_${tenantId}_${sessionToken}`;
exports.getSessionRoom = getSessionRoom;
const initSocket = (server) => {
    exports.io = new socket_io_1.Server(server, {
        cors: {
            origin: true,
            credentials: true,
        },
    });
    if (process.env.REDIS_URL) {
        const redisOptions = {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            connectTimeout: 1500,
            retryStrategy: () => null,
        };
        const pubClient = new ioredis_1.default(process.env.REDIS_URL, redisOptions);
        const subClient = pubClient.duplicate(redisOptions);
        const suppressUnhandledRedisError = () => { };
        // ioredis can emit early connection errors before connect() settles.
        // Attach a temporary listener immediately to avoid "Unhandled error event" noise in dev.
        pubClient.on('error', suppressUnhandledRedisError);
        subClient.on('error', suppressUnhandledRedisError);
        void (async () => {
            try {
                await pubClient.connect();
                await subClient.connect();
                pubClient.off('error', suppressUnhandledRedisError);
                subClient.off('error', suppressUnhandledRedisError);
                pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
                subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));
                exports.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
                console.log('Redis adapter for Socket.IO successfully connected');
            }
            catch (err) {
                pubClient.off('error', suppressUnhandledRedisError);
                subClient.off('error', suppressUnhandledRedisError);
                const reason = err instanceof Error ? err.message : 'Unknown connection error';
                if (process.env.NODE_ENV === 'production') {
                    console.warn(`REDIS_URL is configured, but Redis is unreachable. Using the default in-memory Socket.IO adapter. (${reason})`);
                }
                if (pubClient.status !== 'end') {
                    pubClient.disconnect();
                }
                if (subClient.status !== 'end') {
                    subClient.disconnect();
                }
            }
        })();
    }
    else {
        console.warn('REDIS_URL not provided. Using fallback memory adapter for WebSockets. (Not recommended for multi-instance deployments)');
    }
    exports.io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (token) {
                const decoded = (0, jwt_1.verifyAccessToken)(token);
                socket.data.user = decoded;
                socket.join((0, exports.getTenantRoom)(decoded.tenantId));
                return next();
            }
            const { tenantSlug, sessionToken } = socket.handshake.auth;
            if (!tenantSlug || !sessionToken) {
                throw new Error('Authentication error');
            }
            const tenant = await prisma_1.prisma.tenant.findUnique({
                where: { slug: tenantSlug },
                select: { id: true },
            });
            if (!tenant) {
                throw new Error('Authentication error');
            }
            socket.data.sessionToken = sessionToken;
            socket.data.tenantId = tenant.id;
            socket.join((0, exports.getSessionRoom)(tenant.id, sessionToken));
            next();
        }
        catch (error) {
            next(new Error('Authentication error'));
        }
    });
    exports.io.on('connection', (socket) => {
        const tenantId = socket.data.user?.tenantId || socket.data.tenantId;
        console.log(`Socket connected: ${socket.id} for tenant: ${tenantId}`);
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    return exports.io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!exports.io) {
        throw new Error('Socket.io not initialized!');
    }
    return exports.io;
};
exports.getIO = getIO;
//# sourceMappingURL=socket.js.map