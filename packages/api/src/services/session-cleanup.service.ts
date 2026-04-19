import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';
import { prisma } from '../db/prisma';
import { lockSessionForMutation } from '../db/session-lock';
import { getIO, getSessionRoom, getTenantRoom } from '../socket';
import { deleteCache, getRedisClient } from './cache.service';
import { cacheKeys } from '../utils/cache-keys';
import { logger } from '../utils/logger';
import {
  recordSessionCleanupComplete,
  recordSessionCleanupFailure,
  recordSessionCleanupLeaseSkip,
  recordSessionCleanupStart,
} from './runtime-metrics.service';

const CLEANUP_LOCK_KEY = 'jobs:session_cleanup:lock';
const CLEANUP_LOCK_TTL_SECONDS = 9 * 60;

async function invalidateCleanupCaches(tenantId: string, sessionId: string) {
  await Promise.all([
    deleteCache(cacheKeys.dashboardLiveOrders(tenantId)),
    deleteCache(cacheKeys.dashboardOrderHistoryPattern(tenantId)),
    deleteCache(cacheKeys.publicSession(tenantId, sessionId)),
    deleteCache(cacheKeys.sessionOrders(tenantId, sessionId)),
  ]);
}

async function acquireCleanupLease() {
  const redis = getRedisClient();
  if (!redis) {
    return {
      acquired: true,
      async release() {},
    };
  }

  const token = randomUUID();

  try {
    const lockResult = await redis.set(CLEANUP_LOCK_KEY, token, 'EX', CLEANUP_LOCK_TTL_SECONDS, 'NX');
    if (lockResult !== 'OK') {
      return {
        acquired: false,
        async release() {},
      };
    }

    return {
      acquired: true,
      async release() {
        try {
          await redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            CLEANUP_LOCK_KEY,
            token,
          );
        } catch (error) {
          logger.warn({ error }, '[SESSION_CLEANUP] Failed to release Redis lease');
        }
      },
    };
  } catch (error) {
    logger.warn({ error }, '[SESSION_CLEANUP] Redis lease unavailable, skipping this run');
    return {
      acquired: false,
      async release() {},
    };
  }
}

/**
 * Automatically cancels only zero-order sessions that have been open for
 * more than 6 hours.
 *
 * Sessions with any non-cancelled orders are never auto-closed here.
 * They require explicit operator action through the billing flow.
 */
export async function cleanupStaleSessions(expectedStartedAtMs?: number) {
  const lease = await acquireCleanupLease();
  if (!lease.acquired) {
    recordSessionCleanupLeaseSkip();
    logger.info('[SESSION_CLEANUP] Skipped because another instance owns the lease');
    return;
  }

  const runStartedAtMs = Date.now();
  recordSessionCleanupStart(expectedStartedAtMs);
  let cancelled = 0;
  let skipped = 0;

  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const staleSessions = await prisma.diningSession.findMany({
      where: {
        sessionStatus: { notIn: ['CLOSED', 'CANCELLED'] },
        openedAt: { lt: sixHoursAgo },
      },
      select: {
        id: true,
        tenantId: true,
        tableId: true,
        openedAt: true,
      },
      orderBy: { openedAt: 'asc' },
      take: 250,
    });

    if (staleSessions.length === 0) {
      logger.info('[SESSION_CLEANUP] No stale sessions found');
      return;
    }

    logger.info(`[SESSION_CLEANUP] Evaluating ${staleSessions.length} stale sessions`);

    for (const session of staleSessions) {
      try {
        const outcome = await prisma.$transaction(async (tx) => {
          await lockSessionForMutation(tx, session.id);

          const lockedSession = await tx.diningSession.findUnique({
            where: { id: session.id },
            select: {
              id: true,
              tenantId: true,
              tableId: true,
              openedAt: true,
              sessionStatus: true,
              _count: {
                select: {
                  orders: {
                    where: { status: { notIn: ['CANCELLED'] } },
                  },
                },
              },
            },
          });

          if (!lockedSession || ['CLOSED', 'CANCELLED'].includes(lockedSession.sessionStatus)) {
            return { action: 'noop' as const };
          }

          if (lockedSession._count.orders > 0) {
            return {
              action: 'skip' as const,
              orderCount: lockedSession._count.orders,
              openedAt: lockedSession.openedAt,
            };
          }

          await tx.diningSession.update({
            where: { id: lockedSession.id },
            data: {
              sessionStatus: 'CANCELLED' as any,
              closedAt: new Date(),
            },
          });

          if (lockedSession.tableId) {
            await tx.table.update({
              where: { id: lockedSession.tableId },
              data: {
                status: 'AVAILABLE',
                currentOrderId: null,
                currentSessionId: null,
              },
            });
          }

          return {
            action: 'cancelled' as const,
            sessionId: lockedSession.id,
            tenantId: lockedSession.tenantId,
            tableId: lockedSession.tableId,
          };
        });

        if (outcome.action === 'skip') {
          skipped++;
          const ageHours = ((Date.now() - outcome.openedAt.getTime()) / 3_600_000).toFixed(1);
          logger.warn(
            { sessionId: session.id, tenantId: session.tenantId, orderCount: outcome.orderCount, ageHours },
            `[SESSION_CLEANUP] SKIPPED ${session.id} - live order appeared during cleanup lock.`,
          );
          continue;
        }

        if (outcome.action === 'cancelled') {
          cancelled++;
          logger.info(
            `[SESSION_CLEANUP] Auto-cancelled zero-order session: ${outcome.sessionId} (table: ${outcome.tableId ?? 'none'})`,
          );

          const updatePayload = {
            sessionId: outcome.sessionId,
            status: 'CANCELLED',
            updatedAt: new Date().toISOString(),
          };

          const tenantRoom = getTenantRoom(outcome.tenantId);
          const sessionRoom = getSessionRoom(outcome.tenantId, outcome.sessionId);
          getIO().to(tenantRoom).emit('session:update', updatePayload);
          getIO().to(sessionRoom).emit('session:update', updatePayload);

          if (outcome.tableId) {
            getIO().to(tenantRoom).emit('table:status_change', {
              tableId: outcome.tableId,
              status: 'AVAILABLE',
            });
          }

          await invalidateCleanupCaches(outcome.tenantId, outcome.sessionId);
        }
      } catch (err) {
        logger.error({ err }, `[SESSION_CLEANUP] Failed to cancel session ${session.id}`);
        Sentry.captureException(err, {
          extra: { sessionId: session.id, tenantId: session.tenantId },
        });
      }
    }

    logger.info(
      `[SESSION_CLEANUP] Complete - cancelled: ${cancelled}, skipped (has live orders): ${skipped}`,
    );
  } catch (error) {
    recordSessionCleanupFailure();
    logger.error({ error }, '[SESSION_CLEANUP_CRITICAL_ERROR]');
    Sentry.captureException(error);
  } finally {
    recordSessionCleanupComplete({
      startedAtMs: runStartedAtMs,
      cancelledSessions: cancelled,
      skippedSessions: skipped,
    });
    await lease.release();
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;
let nextExpectedRunAtMs: number | null = null;

/**
 * Starts the background session cleanup job.
 * - Delays the first run by 2 minutes after startup
 * - Default interval: 10 minutes
 */
export function startSessionCleanupJob(intervalMs: number = 10 * 60 * 1000) {
  if (cleanupInterval) return;

  logger.info(`[SESSION_CLEANUP] Scheduling cleanup job (interval: ${intervalMs / 60000}m, first run in 2m)`);
  nextExpectedRunAtMs = Date.now() + 2 * 60 * 1000;

  startupTimer = setTimeout(() => {
    const scheduledAt = nextExpectedRunAtMs ?? Date.now();
    void cleanupStaleSessions(scheduledAt);
    nextExpectedRunAtMs = Date.now() + intervalMs;
    cleanupInterval = setInterval(() => {
      const scheduledAt = nextExpectedRunAtMs ?? Date.now();
      nextExpectedRunAtMs = scheduledAt + intervalMs;
      void cleanupStaleSessions(scheduledAt);
    }, intervalMs);
  }, 2 * 60 * 1000);
}

export function stopSessionCleanupJob() {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[SESSION_CLEANUP] Stopped cleanup job.');
  }
  nextExpectedRunAtMs = null;
}
