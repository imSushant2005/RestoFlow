import { prisma } from '../db/prisma';
import { performSessionCompletion } from '../controllers/session.controller';
import { logger } from '../utils/logger';

/**
 * Automatically closes sessions that have been open for more than 1 hour.
 */
export async function cleanupStaleSessions() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Find sessions that are not closed/cancelled and were opened more than an hour ago
    const staleSessions = await prisma.diningSession.findMany({
      where: {
        sessionStatus: { notIn: ['CLOSED', 'CANCELLED'] },
        openedAt: { lt: oneHourAgo }
      },
      select: { id: true, tenantId: true, tableId: true }
    });

    if (staleSessions.length === 0) return;

    logger.info(`[SESSION_CLEANUP] Found ${staleSessions.length} stale sessions to auto-close.`);

    for (const session of staleSessions) {
      try {
        await performSessionCompletion(session.id, session.tenantId, 'cash', true);
        logger.info(`[SESSION_CLEANUP] Auto-closed stale session: ${session.id} (Table: ${session.tableId})`);
      } catch (err) {
        logger.error({ err }, `[SESSION_CLEANUP] Failed to auto-close session ${session.id}:`);
      }
    }
  } catch (error) {
    logger.error({ error }, '[SESSION_CLEANUP_CRITICAL_ERROR]');
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startSessionCleanupJob(intervalMs: number = 5 * 60 * 1000) { // Default: Every 5 minutes
  if (cleanupInterval) return;
  
  logger.info(`[SESSION_CLEANUP] Starting background cleanup job (Interval: ${intervalMs}ms)`);
  
  // Run once immediately on start
  void cleanupStaleSessions();
  
  cleanupInterval = setInterval(() => {
    void cleanupStaleSessions();
  }, intervalMs);
}

export function stopSessionCleanupJob() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[SESSION_CLEANUP] Stopped background cleanup job.');
  }
}
