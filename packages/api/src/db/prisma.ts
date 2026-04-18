import { PrismaClient } from '@dineflow/prisma';
import {
  recordPrismaQuery,
  recordPrismaRetry,
  recordPrismaRetryFailure,
} from '../services/runtime-metrics.service';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaShutdownHooksRegistered?: boolean;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
      { level: 'query', emit: 'event' },
    ],
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
    transactionOptions: {
      // Neon + pooled Postgres can be bursty under concurrent local dev and
      // order/session flows do several sequential writes. Prisma's default
      // interactive transaction timeout is too short for this workload.
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

const PERF_ALERT_THRESHOLD_MS = 500;
const PRISMA_RETRY_LIMIT = 2;
const PRISMA_RETRY_BACKOFF_MS = 150;
let prismaReconnectPromise: Promise<void> | null = null;

(prisma as any).$on('query', (event: any) => {
  const normalizedQuery = String(event.query || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (normalizedQuery === 'SELECT 1') return;

  recordPrismaQuery(event.duration, String(event.query || ''), PERF_ALERT_THRESHOLD_MS);

  if (process.env.NODE_ENV !== 'production' && event.duration >= PERF_ALERT_THRESHOLD_MS) {
    console.warn(`[PRISMA_PERF_ALERT]: Slow query detected (${event.duration}ms):`, event.query);
  }
});

async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('[PRISMA_DISCONNECT_ERROR]', error);
  }
}

async function ensurePrismaConnected() {
  if (!prismaReconnectPromise) {
    prismaReconnectPromise = prisma
      .$connect()
      .catch((error) => {
        console.error('[PRISMA_CONNECT_ERROR]', error);
        throw error;
      })
      .finally(() => {
        prismaReconnectPromise = null;
      });
  }

  return prismaReconnectPromise;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientPrismaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('kind: Closed') ||
    message.includes('Connection closed') ||
    message.includes('Socket closed') ||
    message.includes('Can\'t reach database server') ||
    message.includes('Timed out fetching a new connection') ||
    message.includes('P1001') ||
    message.includes('P1017')
  );
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  label = 'prisma-operation',
  maxRetries = PRISMA_RETRY_LIMIT,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientPrismaError(error) || attempt >= maxRetries) {
        if (isTransientPrismaError(error)) {
          recordPrismaRetryFailure();
        }
        throw error;
      }

      attempt += 1;
      recordPrismaRetry();
      const waitMs = PRISMA_RETRY_BACKOFF_MS * 2 ** (attempt - 1);
      console.warn(
        `[PRISMA_RETRY] ${label} attempt ${attempt}/${maxRetries} after transient error:`,
        error instanceof Error ? error.message : String(error),
      );

      try {
        await ensurePrismaConnected();
      } catch {}

      await sleep(waitMs);
    }
  }
}

function registerPrismaShutdownHooks() {
  if (globalForPrisma.prismaShutdownHooksRegistered) return;
  globalForPrisma.prismaShutdownHooksRegistered = true;

  process.once('beforeExit', () => {
    void disconnectPrisma();
  });
  process.once('SIGINT', () => {
    void disconnectPrisma();
  });
  process.once('SIGTERM', () => {
    void disconnectPrisma();
  });
}

export async function checkPrismaReadiness(timeoutMs = 3000) {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error(`Prisma readiness probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  await Promise.race([withPrismaRetry(() => prisma.$queryRawUnsafe('SELECT 1'), 'readiness-probe'), timeoutPromise]);
}

registerPrismaShutdownHooks();

void ensurePrismaConnected();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
