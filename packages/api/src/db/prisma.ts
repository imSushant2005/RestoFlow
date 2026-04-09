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

// Performance monitoring: Log queries taking longer than 200ms
if (process.env.NODE_ENV !== 'production') {
  (prisma as any).$on('query', (e: any) => {
    if (e.duration > 200) {
      console.warn(`[PRISMA_PERF_ALERT]: Slow query detected (${e.duration}ms):`, e.query);
    }
  });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
