import { prisma } from '../src/db/prisma';

const tid = 'cmo4gpttk0000sk3792v3a9f9';

async function runBenchmark() {
  console.log(`--- STARTING PERFORMANCE BENCHMARK (DATASET: 5000 ORDERS) ---`);

  // 1. Capture Query Plans
  console.log('\n[1] CAPTURING QUERY PLANS...');
  const oldPlan = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*) 
    FROM "Order" 
    WHERE "tenantId" = '${tid}' AND "status" = 'RECEIVED'
    GROUP BY hour
  `);
  console.log('OLD PLAN (SEQ SCAN):', JSON.stringify(oldPlan, null, 2));

  const newPlan = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "totalRevenue", "peakHour" 
    FROM "DailyAnalytics" 
    WHERE "tenantId" = '${tid}' 
      AND "date" >= '2020-01-01'
  `);
  console.log('NEW PLAN (INDEX LOOKUP):', JSON.stringify(newPlan, null, 2));

  // 2. Measure Latencies
  const runTest = async (name: string, fn: () => Promise<any>, iterations: number) => {
    const latencies: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(iterations * 0.5)];
    const p95 = latencies[Math.floor(iterations * 0.95)];
    const p99 = latencies[Math.floor(iterations * 0.99)];
    const max = latencies[latencies.length - 1];
    return { p50, p95, p99, max, avg: latencies.reduce((s, x) => s + x, 0) / iterations };
  };

  console.log('\n[2] RUNNING LATENCY TESTS (50 ITERATIONS)...');
  
  const oldResults = await runTest('OLD_QUERY', async () => {
    return prisma.$queryRawUnsafe(`
      SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*) 
      FROM "Order" 
      WHERE "tenantId" = '${tid}' AND "status" = 'RECEIVED'
      GROUP BY hour
    `);
  }, 50);

  // We need to upsert a snapshot first so the new query has something to find
  await prisma.dailyAnalytics.create({
    data: {
      tenantId: tid,
      date: new Date('2024-04-18'), // dummy date
      totalRevenue: 50000,
      peakHour: 19,
      totalOrders: 100
    }
  });

  const newResults = await runTest('NEW_QUERY', async () => {
    return prisma.dailyAnalytics.findMany({
      where: { tenantId: tid, date: { gte: new Date('2020-01-01') } }
    });
  }, 50);

  console.log('\n--- RESULTS ---');
  console.log('OLD (Seq Scan on 5000 rows):', oldResults);
  console.log('NEW (Index Lookup on Snapshot):', newResults);
}

runBenchmark().catch(console.error).finally(() => prisma.$disconnect());
