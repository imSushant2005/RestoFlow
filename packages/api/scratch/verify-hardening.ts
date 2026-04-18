import { prisma } from '../src/db/prisma';
import { warmAnalyticsCache, invalidateAnalyticsCache } from '../src/controllers/analytics.controller';
import { getCache } from '../src/services/cache.service';

async function verifyFlow() {
  const tenantId = 'cmo4gpttk0000sk3792v3a9f9'; // Benchmark tenant
  const cacheKey = `analytics:${tenantId}:d30`;

  console.log('--- VERIFYING END-TO-END ANALYTICS HARDENING ---');

  // 1. Warm the cache
  console.log('1. Warming cache...');
  await warmAnalyticsCache(tenantId);
  const warmData = await getCache(cacheKey);
  if (warmData) {
    console.log('   [SUCCESS] Cache is Warm in Redis.');
  } else {
    console.error('   [FAILURE] Cache not found in Redis.');
  }

  // 2. Simulate Mutation (Invalidation)
  console.log('2. Triggering Invalidation (Simulated Order/Session)...');
  await invalidateAnalyticsCache(tenantId);
  
  const staleData = await getCache(cacheKey);
  if (!staleData) {
    console.log('   [SUCCESS] Cache cleared from Redis after mutation.');
  } else {
    console.error('   [FAILURE] Cache still persists in Redis! Invalidation failed.');
  }

  // 3. Performance Check (Sub-50ms target)
  console.log('3. Measuring Warm Hit latency...');
  await warmAnalyticsCache(tenantId); // re-warm
  const start = performance.now();
  await getCache(cacheKey);
  const latency = performance.now() - start;
  console.log(`   Warm Hit Latency: ${latency.toFixed(2)}ms (Target < 20ms depending on Redis link)`);

  await prisma.$disconnect();
}

verifyFlow().catch(console.error);
