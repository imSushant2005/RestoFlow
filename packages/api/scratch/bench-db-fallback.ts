import { PrismaClient } from '@bhojflow/prisma';

const AGG_QUERY = `
  WITH orders_summary AS (
    SELECT COUNT(id)::int as total_orders, COALESCE(SUM("totalAmount"), 0)::float as total_revenue
    FROM "Order" WHERE "tenantId" = 'cmo4gpttk0000sk3792v3a9f9' AND "status" = 'RECEIVED'
    AND "createdAt" >= NOW() - INTERVAL '30 days'
  )
  SELECT * FROM orders_summary;
`;

async function runFallbackBenchmark() {
  // Simulate Redis outage by NOT using the cache service
  // and forcing a fresh connection (to include handshake cost)
  const url = process.env.DATABASE_URL;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  
  console.log('--- DB FALLBACK BENCHMARK (REDIS UNAVAILABLE) ---');
  
  const results: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await prisma.$queryRawUnsafe(AGG_QUERY);
    const duration = performance.now() - start;
    results.push(duration);
    console.log(`Iteration ${i+1}: ${duration.toFixed(2)}ms`);
  }
  
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const p95 = results.sort((a,b) => a-b)[Math.floor(results.length * 0.95)];
  
  console.log('\n--- RESULTS ---');
  console.log(`Average DB-Only Latency: ${avg.toFixed(2)}ms`);
  console.log(`p95 DB-Only Latency: ${p95.toFixed(2)}ms`);
  
  if (avg < 1000) {
    console.log('VERDICT: Fallback is technically sub-1s on established pool.');
  } else {
    console.log('VERDICT: Fallback exceeds 1s due to cold start/handshake.');
  }
  
  await prisma.$disconnect();
}

runFallbackBenchmark().catch(console.error);
