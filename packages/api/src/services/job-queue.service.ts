import { getRedisClient } from './cache.service';
import { logger } from '../utils/logger';

type QueueJobName = 'billing.receipt.issue' | 'billing.payment.retry';

type QueueJob<T = Record<string, unknown>> = {
  id: string;
  name: QueueJobName;
  payload: T;
  queuedAt: string;
};

type QueueHandler = (job: QueueJob<any>) => Promise<void>;

const memoryQueues = new Map<QueueJobName, QueueJob[]>();
const queueNames: QueueJobName[] = ['billing.receipt.issue', 'billing.payment.retry'];
const redisQueuePrefix = 'bhojflow:jobs';
let workerInterval: NodeJS.Timeout | null = null;
let redisWorkerRunning = false;
let stopped = false;

function getQueueKey(name: QueueJobName) {
  return `${redisQueuePrefix}:${name}`;
}

export async function enqueueJob<T = Record<string, unknown>>(name: QueueJobName, payload: T) {
  const job: QueueJob<T> = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    payload,
    queuedAt: new Date().toISOString(),
  };

  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    await redis.lpush(getQueueKey(name), JSON.stringify(job));
  } else {
    const current = memoryQueues.get(name) || [];
    current.push(job as QueueJob);
    memoryQueues.set(name, current);
  }

  logger.info({ jobId: job.id, name }, 'Background job enqueued');
  return job;
}

async function processMemoryQueues(handlers: Partial<Record<QueueJobName, QueueHandler>>) {
  for (const name of queueNames) {
    const handler = handlers[name];
    if (!handler) continue;

    const queue = memoryQueues.get(name);
    if (!queue?.length) continue;

    const job = queue.shift();
    if (!job) continue;

    try {
      await handler(job);
    } catch (error) {
      logger.error({ err: error, jobId: job.id, name }, 'Background memory job failed');
    }
  }
}

async function processRedisQueues(handlers: Partial<Record<QueueJobName, QueueHandler>>) {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready' || redisWorkerRunning) return;

  redisWorkerRunning = true;
  try {
    while (!stopped) {
      const keys = queueNames.map(getQueueKey);
      const result = await redis.brpop(keys, 2);
      if (!result) continue;

      const [queueKey, rawJob] = result;
      const name = queueNames.find((candidate) => getQueueKey(candidate) === queueKey);
      if (!name) continue;

      const handler = handlers[name];
      if (!handler) continue;

      try {
        const job = JSON.parse(rawJob) as QueueJob;
        await handler(job);
      } catch (error) {
        logger.error({ err: error, queueKey }, 'Background redis job failed');
      }
    }
  } finally {
    redisWorkerRunning = false;
  }
}

export function startJobWorker(handlers: Partial<Record<QueueJobName, QueueHandler>>) {
  stopped = false;
  if (!workerInterval) {
    workerInterval = setInterval(() => {
      void processMemoryQueues(handlers);
    }, 1500);
  }

  void processRedisQueues(handlers);
  logger.info('Background job worker started');
}

export function stopJobWorker() {
  stopped = true;
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  logger.info('Background job worker stopped');
}
