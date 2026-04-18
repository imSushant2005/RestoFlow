import { randomUUID } from 'node:crypto';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';
const TENANT_SLUG = process.env.REDIS_WATCH_TENANT || '';
const INTERVAL_MS = Number(process.env.REDIS_WATCH_INTERVAL_MS || 5000);
const DURATION_SECONDS = Number(process.env.REDIS_WATCH_DURATION_SECONDS || 180);
const WRITE_SAMPLE = String(process.env.REDIS_WATCH_WRITE_SAMPLE || 'false').toLowerCase() === 'true';

if (!TENANT_SLUG) {
  console.error('Missing REDIS_WATCH_TENANT. Example: REDIS_WATCH_TENANT=demo-vendor');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function timedFetch(url, init) {
  const startedAt = Date.now();
  const response = await fetch(url, init);
  const latencyMs = Date.now() - startedAt;
  return { response, latencyMs };
}

function pickOrderableItem(menuResponse) {
  const categories = Array.isArray(menuResponse?.categories) ? menuResponse.categories : [];
  for (const category of categories) {
    for (const item of Array.isArray(category?.menuItems) ? category.menuItems : []) {
      if (item?.id) return item;
    }
  }
  return null;
}

function buildModifierSelection(item) {
  return (Array.isArray(item?.modifierGroups) ? item.modifierGroups : []).flatMap((group) => {
    const modifiers = Array.isArray(group?.modifiers) ? group.modifiers.filter((modifier) => modifier?.id) : [];
    const requiredCount = Math.max(Number(group?.minSelections || 0), group?.isRequired ? 1 : 0);
    return modifiers.slice(0, requiredCount).map((modifier) => ({ id: modifier.id }));
  });
}

async function loadScenario() {
  const { response } = await timedFetch(`${BASE_URL}/public/${TENANT_SLUG}/menu`);
  if (!response.ok) {
    throw new Error(`Failed to load menu for ${TENANT_SLUG}: ${response.status}`);
  }

  const menu = await response.json();
  const item = pickOrderableItem(menu);
  if (!item) {
    throw new Error(`No orderable menu item found for ${TENANT_SLUG}`);
  }

  return {
    itemId: item.id,
    selectedModifiers: buildModifierSelection(item),
  };
}

async function sampleOrderWrite(scenario) {
  const key = `redis_watch_${randomUUID()}`;
  const { response, latencyMs } = await timedFetch(`${BASE_URL}/public/${TENANT_SLUG}/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': key,
    },
    body: JSON.stringify({
      customerName: 'Redis Watch',
      customerPhone: `901${Math.floor(Math.random() * 1_000_0000).toString().padStart(7, '0')}`,
      items: [
        {
          menuItemId: scenario.itemId,
          quantity: 1,
          selectedModifiers: scenario.selectedModifiers,
        },
      ],
    }),
  });

  return { ok: response.ok, status: response.status, latencyMs };
}

async function main() {
  const scenario = await loadScenario();
  const deadlineAt = Date.now() + DURATION_SECONDS * 1000;
  const samples = [];

  console.log(
    `[redis-failure-watch] watching ${TENANT_SLUG} for ${DURATION_SECONDS}s. Kill Redis during this window to validate degraded behavior.`,
  );
  console.log(`[redis-failure-watch] write sample ${WRITE_SAMPLE ? 'enabled' : 'disabled'}`);

  while (Date.now() < deadlineAt) {
    const [{ response: healthResponse, latencyMs: healthMs }, { response: metricsResponse, latencyMs: metricsMs }] =
      await Promise.all([
        timedFetch(`${BASE_URL}/health/ready`),
        timedFetch(`${BASE_URL}/metrics`),
      ]);

    const health = await healthResponse.json().catch(() => ({}));
    const metrics = await metricsResponse.json().catch(() => ({}));
    const cacheMetrics = metrics?.runtime?.cache || {};
    const dbMetrics = metrics?.runtime?.db || {};
    const sockets = metrics?.sockets || {};

    let writeResult = null;
    if (WRITE_SAMPLE) {
      writeResult = await sampleOrderWrite(scenario).catch((error) => ({
        ok: false,
        status: 0,
        latencyMs: 0,
        error: error instanceof Error ? error.message : String(error),
      }));
    }

    const snapshot = {
      at: new Date().toISOString(),
      healthStatus: health?.status || healthResponse.status,
      healthMs,
      metricsMs,
      redisState: cacheMetrics.redisState || metrics?.dependencies?.redis || 'unknown',
      cacheHitRate: cacheMetrics.hitRatePercent ?? null,
      redisFailures: cacheMetrics.redisFailures ?? null,
      dbAvgMs: dbMetrics.avgDurationMs ?? null,
      dbMaxMs: dbMetrics.maxDurationMs ?? null,
      sockets: sockets.activeConnections ?? null,
      writeOk: writeResult?.ok ?? null,
      writeStatus: writeResult?.status ?? null,
      writeMs: writeResult?.latencyMs ?? null,
    };

    samples.push(snapshot);
    console.log(JSON.stringify(snapshot));
    await sleep(INTERVAL_MS);
  }

  console.log(`[redis-failure-watch] completed ${samples.length} samples`);
}

main().catch((error) => {
  console.error('[redis-failure-watch] fatal', error);
  process.exit(1);
});
