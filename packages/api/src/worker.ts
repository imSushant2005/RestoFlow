import './instrumentation';
import { checkPrismaReadiness } from './db/prisma';
import { startSessionCleanupJob, stopSessionCleanupJob, cleanupStaleSessions } from './services/session-cleanup.service';
import { logger } from './utils/logger';

async function main() {
  await checkPrismaReadiness();
  logger.info('BHOJFLOW worker booted');

  await cleanupStaleSessions();
  startSessionCleanupJob();
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker');
  stopSessionCleanupJob();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

main().catch((error) => {
  logger.error({ error }, 'Worker failed to start');
  process.exit(1);
});
