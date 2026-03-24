import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from './utils/jwt';
import { prisma } from './db/prisma';

import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export let io: Server;

export const getTenantRoom = (tenantId: string) => `tenant_${tenantId}`;
export const getSessionRoom = (tenantId: string, sessionToken: string) => `session_${tenantId}_${sessionToken}`;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
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
    } as const;

    const pubClient = new Redis(process.env.REDIS_URL, redisOptions);
    const subClient = pubClient.duplicate(redisOptions);
    const suppressUnhandledRedisError = () => {};

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

        io.adapter(createAdapter(pubClient, subClient));
        console.log('Redis adapter for Socket.IO successfully connected');
      } catch (err) {
        pubClient.off('error', suppressUnhandledRedisError);
        subClient.off('error', suppressUnhandledRedisError);
        const reason = err instanceof Error ? err.message : 'Unknown connection error';
        if (process.env.NODE_ENV === 'production') {
          console.warn(
            `REDIS_URL is configured, but Redis is unreachable. Using the default in-memory Socket.IO adapter. (${reason})`,
          );
        }
        if (pubClient.status !== 'end') {
          pubClient.disconnect();
        }
        if (subClient.status !== 'end') {
          subClient.disconnect();
        }
      }
    })();
  } else {
    console.warn(
      'REDIS_URL not provided. Using fallback memory adapter for WebSockets. (Not recommended for multi-instance deployments)',
    );
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const decoded = verifyAccessToken(token);
        socket.data.user = decoded;
        socket.join(getTenantRoom(decoded.tenantId));
        return next();
      }

      const { tenantSlug, sessionToken } = socket.handshake.auth;
      if (!tenantSlug || !sessionToken) {
        throw new Error('Authentication error');
      }

      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      });

      if (!tenant) {
        throw new Error('Authentication error');
      }

      socket.data.sessionToken = sessionToken;
      socket.data.tenantId = tenant.id;
      socket.join(getSessionRoom(tenant.id, sessionToken));
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const tenantId = socket.data.user?.tenantId || socket.data.tenantId;
    console.log(`Socket connected: ${socket.id} for tenant: ${tenantId}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
