type CacheSource = 'redis' | 'memory' | 'bypass';
type RedisState = 'not_configured' | 'connecting' | 'ready' | 'unavailable';

type CacheMetricsState = {
  gets: number;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  redisFailures: number;
  memoryFallbackReads: number;
  memoryFallbackWrites: number;
  bypassReads: number;
  bypassWrites: number;
  redisReadyTransitions: number;
  redisDisconnectTransitions: number;
  redisState: RedisState;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

type PrismaMetricsState = {
  queries: number;
  slowQueries: number;
  totalDurationMs: number;
  maxDurationMs: number;
  retries: number;
  retryFailures: number;
  lastSlowQueryAt: string | null;
  lastSlowQueryMs: number | null;
  lastSlowQueryPreview: string | null;
};

type SessionCleanupMetricsState = {
  runs: number;
  activeRuns: number;
  leaseSkips: number;
  failures: number;
  cancelledSessions: number;
  skippedSessions: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastDurationMs: number;
  maxDurationMs: number;
  lastRunDelayMs: number;
};

const cacheMetrics: CacheMetricsState = {
  gets: 0,
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
  redisFailures: 0,
  memoryFallbackReads: 0,
  memoryFallbackWrites: 0,
  bypassReads: 0,
  bypassWrites: 0,
  redisReadyTransitions: 0,
  redisDisconnectTransitions: 0,
  redisState: 'not_configured',
  lastErrorAt: null,
  lastErrorMessage: null,
};

const prismaMetrics: PrismaMetricsState = {
  queries: 0,
  slowQueries: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
  retries: 0,
  retryFailures: 0,
  lastSlowQueryAt: null,
  lastSlowQueryMs: null,
  lastSlowQueryPreview: null,
};

const sessionCleanupMetrics: SessionCleanupMetricsState = {
  runs: 0,
  activeRuns: 0,
  leaseSkips: 0,
  failures: 0,
  cancelledSessions: 0,
  skippedSessions: 0,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastDurationMs: 0,
  maxDurationMs: 0,
  lastRunDelayMs: 0,
};

function nowIso() {
  return new Date().toISOString();
}

function clampPreview(input: string, maxLength = 180) {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function setRedisState(state: RedisState) {
  if (cacheMetrics.redisState === state) return;
  cacheMetrics.redisState = state;
  if (state === 'ready') {
    cacheMetrics.redisReadyTransitions += 1;
  }
  if (state === 'unavailable') {
    cacheMetrics.redisDisconnectTransitions += 1;
  }
}

export function recordCacheRead(hit: boolean, source: CacheSource) {
  cacheMetrics.gets += 1;
  if (hit) {
    cacheMetrics.hits += 1;
  } else {
    cacheMetrics.misses += 1;
  }

  if (source === 'memory') {
    cacheMetrics.memoryFallbackReads += 1;
  } else if (source === 'bypass') {
    cacheMetrics.bypassReads += 1;
  }
}

export function recordCacheWrite(source: CacheSource) {
  cacheMetrics.sets += 1;
  if (source === 'memory') {
    cacheMetrics.memoryFallbackWrites += 1;
  } else if (source === 'bypass') {
    cacheMetrics.bypassWrites += 1;
  }
}

export function recordCacheDelete() {
  cacheMetrics.deletes += 1;
}

export function recordCacheError(error: unknown) {
  cacheMetrics.errors += 1;
  cacheMetrics.lastErrorAt = nowIso();
  cacheMetrics.lastErrorMessage = error instanceof Error ? error.message : String(error || 'unknown');
}

export function recordRedisFailure(error: unknown) {
  cacheMetrics.redisFailures += 1;
  recordCacheError(error);
  setRedisState('unavailable');
}

export function recordPrismaQuery(durationMs: number, query: string, slowThresholdMs: number) {
  prismaMetrics.queries += 1;
  prismaMetrics.totalDurationMs += durationMs;
  prismaMetrics.maxDurationMs = Math.max(prismaMetrics.maxDurationMs, durationMs);

  if (durationMs >= slowThresholdMs) {
    prismaMetrics.slowQueries += 1;
    prismaMetrics.lastSlowQueryAt = nowIso();
    prismaMetrics.lastSlowQueryMs = durationMs;
    prismaMetrics.lastSlowQueryPreview = clampPreview(query);
  }
}

export function recordPrismaRetry() {
  prismaMetrics.retries += 1;
}

export function recordPrismaRetryFailure() {
  prismaMetrics.retryFailures += 1;
}

export function recordSessionCleanupStart(expectedStartedAtMs?: number) {
  sessionCleanupMetrics.runs += 1;
  sessionCleanupMetrics.activeRuns += 1;
  sessionCleanupMetrics.lastStartedAt = nowIso();
  sessionCleanupMetrics.lastRunDelayMs =
    expectedStartedAtMs != null ? Math.max(0, Date.now() - expectedStartedAtMs) : 0;
}

export function recordSessionCleanupLeaseSkip() {
  sessionCleanupMetrics.leaseSkips += 1;
}

export function recordSessionCleanupFailure() {
  sessionCleanupMetrics.failures += 1;
}

export function recordSessionCleanupComplete(options: {
  startedAtMs: number;
  cancelledSessions: number;
  skippedSessions: number;
}) {
  sessionCleanupMetrics.activeRuns = Math.max(0, sessionCleanupMetrics.activeRuns - 1);
  sessionCleanupMetrics.cancelledSessions += options.cancelledSessions;
  sessionCleanupMetrics.skippedSessions += options.skippedSessions;
  sessionCleanupMetrics.lastCompletedAt = nowIso();
  sessionCleanupMetrics.lastDurationMs = Math.max(0, Date.now() - options.startedAtMs);
  sessionCleanupMetrics.maxDurationMs = Math.max(
    sessionCleanupMetrics.maxDurationMs,
    sessionCleanupMetrics.lastDurationMs,
  );
}

export function getRuntimeMetricsSnapshot() {
  const cacheHitRate =
    cacheMetrics.gets > 0 ? Math.round((cacheMetrics.hits / cacheMetrics.gets) * 10_000) / 100 : 0;
  const dbAvgMs =
    prismaMetrics.queries > 0
      ? Math.round((prismaMetrics.totalDurationMs / prismaMetrics.queries) * 100) / 100
      : 0;

  return {
    cache: {
      ...cacheMetrics,
      hitRatePercent: cacheHitRate,
    },
    db: {
      ...prismaMetrics,
      avgDurationMs: dbAvgMs,
    },
    jobs: {
      sessionCleanup: { ...sessionCleanupMetrics },
    },
  };
}
