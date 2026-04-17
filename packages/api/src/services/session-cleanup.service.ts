import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/node';

/**
 * Automatically cancels ONLY zero-order sessions that have been open for
 * more than 6 hours (previous threshold: 1 hour).
 *
 * KEY SAFETY RULE:
 * Sessions with ANY non-cancelled orders are NEVER auto-closed here.
 * They require explicit operator action via the billing flow.
 * Touching them automatically risks generating incorrect bills or
 * misrepresenting payment method.
 *
 * Classification: PATCH NOW — critical data-integrity guard.
 */
export async function cleanupStaleSessions() {
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

    if (staleSessions.length === 0) {
      logger.info('[SESSION_CLEANUP] No stale sessions found');
      return;
    }

    logger.info(`[SESSION_CLEANUP] Evaluating ${staleSessions.length} stale sessions`);

    let cancelled = 0;
    let skipped = 0;

    for (const session of staleSessions) {
      const orderCount = session._count.orders;

      // HARD GUARD: Never auto-close a session that has live orders.
      // Operators must reconcile these manually through the billing panel.
      if (orderCount > 0) {
        skipped++;
        const ageHours = ((Date.now() - session.openedAt.getTime()) / 3_600_000).toFixed(1);
        logger.warn(
          { sessionId: session.id, tenantId: session.tenantId, orderCount, ageHours },
          `[SESSION_CLEANUP] SKIPPED ${session.id} — has ${orderCount} live orders, open for ${ageHours}h. Manual closure required.`,
        );
        // Alert via Sentry so operators are notified of long-running sessions
        Sentry.captureMessage(
          `[RestoFlow] Long-running session ${session.id} needs attention (${ageHours}h, ${orderCount} orders)`,
          {
            level: 'warning',
            extra: {
              sessionId: session.id,
              tenantId: session.tenantId,
              tableId: session.tableId,
              openedAt: session.openedAt.toISOString(),
              orderCount,
              ageHours,
            },
          },
        );
        continue;
      }

      // Only cancel zero-order sessions (e.g. abandoned QR scans, accidental opens).
      // These get CANCELLED (not CLOSED) — no bill is ever generated for them.
      try {
        await prisma.$transaction(async (tx) => {
          await tx.diningSession.update({
            where: { id: session.id },
            data: {
              sessionStatus: 'CANCELLED' as any, // Not CLOSED — CLOSED implies a bill exists
              closedAt: new Date(),
            },
          });

          // Free the table so it shows as AVAILABLE again
          if (session.tableId) {
            await tx.table.update({
              where: { id: session.tableId },
              data: {
                status: 'AVAILABLE',
                currentOrderId: null,
                currentSessionId: null,
              },
            });
          }
        });

        cancelled++;
        logger.info(
          `[SESSION_CLEANUP] Auto-cancelled zero-order session: ${session.id} (table: ${session.tableId ?? 'none'})`,
        );
      } catch (err) {
        logger.error({ err }, `[SESSION_CLEANUP] Failed to cancel session ${session.id}`);
        Sentry.captureException(err, {
          extra: { sessionId: session.id, tenantId: session.tenantId },
        });
      }
    }

    logger.info(
      `[SESSION_CLEANUP] Complete — cancelled: ${cancelled}, skipped (has live orders): ${skipped}`,
    );
  } catch (error) {
    logger.error({ error }, '[SESSION_CLEANUP_CRITICAL_ERROR]');
    Sentry.captureException(error);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;

/**
 * Starts the background session cleanup job.
 * - Delays the first run by 2 minutes after startup (lets the server stabilize)
 * - Default interval: 10 minutes (was 5 — reduced frequency to lower DB pressure)
 */
export function startSessionCleanupJob(intervalMs: number = 10 * 60 * 1000) {
  if (cleanupInterval) return; // Prevent double-start

  logger.info(`[SESSION_CLEANUP] Scheduling cleanup job (interval: ${intervalMs / 60000}m, first run in 2m)`);

  // Delay first run so API has time to fully initialize
  startupTimer = setTimeout(() => {
    void cleanupStaleSessions();
    cleanupInterval = setInterval(() => {
      void cleanupStaleSessions();
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
}
