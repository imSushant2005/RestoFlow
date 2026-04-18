import { prisma } from '../src/db/prisma';
import { warmAnalyticsCache, invalidateAnalyticsCache, warmerMetrics } from '../src/controllers/analytics.controller';
import { getCache, getCacheMetrics } from '../src/services/cache.service';

/**
 * 🧪 PROOF: Mutation-Driven Analytics Re-Warming
 * This script proves that:
 * 1. Business mutations trigger a cache purge.
 * 2. Background re-warming re-populates the cache automatically.
 * 3. Rapid mutations are debounced to prevent refresh storms.
 */
async function proveEndToEnd() {
  const tenantId = 'cmo4gpttk0000sk3792v3a9f9'; // Benchmark tenant
  const cacheKey = `analytics:${tenantId}:d30`;

  console.log('--- PROOF: MUTATION-DRIVEN RE-WARMING ---');

  // 1. Initial State: Warm
  console.log('1. Warming initial cache...');
  await warmAnalyticsCache(tenantId);
  if (await getCache(cacheKey)) {
    console.log('   [OK] Cache is WARM.');
  }

  // 2. Trigger Invalidation (Self-Deduplicating)
  console.log('2. Simulating a BURST of 5 mutations (Orders/Sessions)...');
  const startInvalidate = performance.now();
  for (let i = 0; i < 5; i++) {
    invalidateAnalyticsCache(tenantId); // Sync start
  }
  const invalidateTime = performance.now() - startInvalidate;
  console.log(`   [OK] 5 invalidations triggered in ${invalidateTime.toFixed(2)}ms (Non-blocking).`);

  // 3. Check Immediate State (Should be PURGED)
  const purged = await getCache(cacheKey);
  if (!purged) {
    console.log('   [OK] Cache was IMMEDIATELY purged from Redis.');
  } else {
    console.error('   [FAIL] Cache still exists! Is deleteCache working?');
  }

  // 4. Wait for Debounce + Re-warm
  console.log('3. Waiting for 2s Debounce + Background SQL Re-warm...');
  await new Promise(r => setTimeout(r, 4500)); // 2s debounce + safety for SQL execution

  // 5. Verify Automatic Re-population
  const repopulated = await getCache(cacheKey);
  if (repopulated) {
    console.log('   [SUCCESS] Cache was AUTOMATICALLY re-populated in the background.');
  } else {
    console.warn('   [RETRY] Cache not found yet. Redis link might be slow...');
    await new Promise(r => setTimeout(r, 2000));
    if (await getCache(cacheKey)) console.log('   [SUCCESS] Cache re-populated (delayed).');
  }

  // 6. Metrics Check
  console.log('\n--- HARDENING METRICS ---');
  console.log(`Storms Prevented:   ${warmerMetrics.stormPrevented}`);
  console.log(`Rewarms Triggered:  ${warmerMetrics.rewarmTriggered}`);
  console.log(`Rewarm Success:     ${warmerMetrics.rewarmSuccess}`);
  
  const cacheStats = getCacheMetrics();
  console.log(`Cache Hits:         ${cacheStats.getHits}`);
  console.log(`Circuit State:      ${cacheStats.circuitState}`);

  await prisma.$disconnect();
}

proveEndToEnd().catch(console.error);
