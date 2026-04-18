import { randomUUID } from 'node:crypto';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';
const vendorSlugs = String(process.env.LOAD_VENDOR_SLUGS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const ORDERS_PER_VENDOR_MIN = Number(process.env.ORDERS_PER_VENDOR_MIN || 10);
const ORDERS_PER_VENDOR_MAX = Number(process.env.ORDERS_PER_VENDOR_MAX || 20);
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || 180);

if (vendorSlugs.length === 0) {
  console.error('Missing LOAD_VENDOR_SLUGS. Example: LOAD_VENDOR_SLUGS=vendor-a,vendor-b');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickOrderableItem(menuResponse) {
  const categories = Array.isArray(menuResponse?.categories) ? menuResponse.categories : [];
  const items = categories.flatMap((category) =>
    Array.isArray(category?.menuItems) ? category.menuItems : [],
  );

  if (items.length === 0) return null;

  return [...items].sort((left, right) => {
    const leftRequired = (left?.modifierGroups || []).reduce(
      (sum, group) => sum + Math.max(Number(group?.minSelections || 0), group?.isRequired ? 1 : 0),
      0,
    );
    const rightRequired = (right?.modifierGroups || []).reduce(
      (sum, group) => sum + Math.max(Number(group?.minSelections || 0), group?.isRequired ? 1 : 0),
      0,
    );
    return leftRequired - rightRequired;
  })[0];
}

function buildModifierSelection(item) {
  const groups = Array.isArray(item?.modifierGroups) ? item.modifierGroups : [];
  return groups.flatMap((group) => {
    const modifiers = Array.isArray(group?.modifiers) ? group.modifiers.filter((modifier) => modifier?.id) : [];
    const requiredCount = Math.max(Number(group?.minSelections || 0), group?.isRequired ? 1 : 0);
    return modifiers.slice(0, requiredCount).map((modifier) => ({ id: modifier.id }));
  });
}

async function loadVendorScenario(slug) {
  const menuResponse = await fetch(`${BASE_URL}/public/${slug}/menu`);
  if (!menuResponse.ok) {
    throw new Error(`Failed to load menu for ${slug}: ${menuResponse.status}`);
  }

  const menu = await menuResponse.json();
  const item = pickOrderableItem(menu);
  if (!item?.id) {
    throw new Error(`No orderable menu item found for ${slug}`);
  }

  return {
    slug,
    itemId: item.id,
    selectedModifiers: buildModifierSelection(item),
  };
}

async function postTakeawayOrder(vendor) {
  const requestStartedAt = Date.now();
  const idempotencyKey = `burst_${vendor.slug}_${randomUUID()}`;
  const response = await fetch(`${BASE_URL}/public/${vendor.slug}/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      customerName: 'Burst Test',
      customerPhone: `900${Math.floor(Math.random() * 1_000_0000).toString().padStart(7, '0')}`,
      items: [
        {
          menuItemId: vendor.itemId,
          quantity: 1,
          selectedModifiers: vendor.selectedModifiers,
        },
      ],
    }),
  });

  const latencyMs = Date.now() - requestStartedAt;
  return { ok: response.ok, status: response.status, latencyMs };
}

async function runVendorLoop(vendor, deadlineAt) {
  const targetRatePerMin =
    ORDERS_PER_VENDOR_MIN +
    Math.floor(Math.random() * Math.max(1, ORDERS_PER_VENDOR_MAX - ORDERS_PER_VENDOR_MIN + 1));
  const intervalMs = Math.max(250, Math.floor(60_000 / Math.max(1, targetRatePerMin)));
  const stats = { slug: vendor.slug, sent: 0, succeeded: 0, failed: 0, maxMs: 0, totalMs: 0 };

  while (Date.now() < deadlineAt) {
    const result = await postTakeawayOrder(vendor).catch((error) => ({
      ok: false,
      status: 0,
      latencyMs: intervalMs,
      error,
    }));

    stats.sent += 1;
    stats.totalMs += result.latencyMs;
    stats.maxMs = Math.max(stats.maxMs, result.latencyMs);
    if (result.ok) {
      stats.succeeded += 1;
    } else {
      stats.failed += 1;
      console.warn(`[burst-orders] ${vendor.slug} failed`, result.status || result.error?.message || 'unknown');
    }

    await sleep(intervalMs);
  }

  return stats;
}

async function main() {
  const scenarios = await Promise.all(vendorSlugs.map((slug) => loadVendorScenario(slug)));
  const deadlineAt = Date.now() + DURATION_SECONDS * 1000;

  console.log(
    `[burst-orders] starting ${scenarios.length} vendors for ${DURATION_SECONDS}s at ${ORDERS_PER_VENDOR_MIN}-${ORDERS_PER_VENDOR_MAX} orders/min/vendor`,
  );

  const results = await Promise.all(scenarios.map((scenario) => runVendorLoop(scenario, deadlineAt)));
  const totals = results.reduce(
    (aggregate, result) => {
      aggregate.sent += result.sent;
      aggregate.succeeded += result.succeeded;
      aggregate.failed += result.failed;
      aggregate.totalMs += result.totalMs;
      aggregate.maxMs = Math.max(aggregate.maxMs, result.maxMs);
      return aggregate;
    },
    { sent: 0, succeeded: 0, failed: 0, totalMs: 0, maxMs: 0 },
  );

  console.table(
    results.map((result) => ({
      vendor: result.slug,
      sent: result.sent,
      succeeded: result.succeeded,
      failed: result.failed,
      avgMs: result.sent > 0 ? Math.round(result.totalMs / result.sent) : 0,
      maxMs: result.maxMs,
    })),
  );

  console.log(
    JSON.stringify(
      {
        totals: {
          sent: totals.sent,
          succeeded: totals.succeeded,
          failed: totals.failed,
          avgMs: totals.sent > 0 ? Math.round(totals.totalMs / totals.sent) : 0,
          maxMs: totals.maxMs,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[burst-orders] fatal', error);
  process.exit(1);
});
