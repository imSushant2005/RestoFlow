import './instrumentation';
import { checkPrismaReadiness } from './db/prisma';
import { startSessionCleanupJob, stopSessionCleanupJob, cleanupStaleSessions } from './services/session-cleanup.service';
import { logger } from './utils/logger';
import { startJobWorker, stopJobWorker } from './services/job-queue.service';

async function main() {
  await checkPrismaReadiness();
  logger.info('BHOJFLOW worker booted');

  await cleanupStaleSessions();
  startSessionCleanupJob();
  startJobWorker({
    'billing.receipt.issue': async (job) => {
      logger.info({ job }, 'Processed billing receipt job');
    },
    'billing.payment.retry': async (job) => {
      logger.info({ job }, 'Processed billing payment retry job');
    },
  });
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker');
  stopSessionCleanupJob();
  stopJobWorker();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

main().catch((error) => {
  logger.error({ error }, 'Worker failed to start');
  process.exit(1);
});
