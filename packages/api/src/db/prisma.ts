import { PrismaClient } from '@dineflow/prisma';

// Use global search to prevent multiple instances of Prisma Client in development.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
      { level: 'query', emit: 'event' },
    ],
  });

const PERF_ALERT_THRESHOLD_MS = 500;

// Performance monitoring: Log only meaningfully slow queries in development.
if (process.env.NODE_ENV !== 'production') {
  (prisma as any).$on('query', (e: any) => {
    const normalizedQuery = String(e.query || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (normalizedQuery === 'SELECT 1') {
      return;
    }

    if (e.duration >= PERF_ALERT_THRESHOLD_MS) {
      console.warn(`[PRISMA_PERF_ALERT]: Slow query detected (${e.duration}ms):`, e.query);
    }
  });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
