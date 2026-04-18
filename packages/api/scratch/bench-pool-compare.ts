import { PrismaClient } from '@dineflow/prisma';

const AGG_QUERY = `
  WITH orders_summary AS (
    SELECT COUNT(id)::int as total_orders, COALESCE(SUM("totalAmount"), 0)::float as total_revenue
    FROM "Order" WHERE "tenantId" = 'cmo4gpttk0000sk3792v3a9f9' AND "status" = 'RECEIVED'
  )
  SELECT * FROM orders_summary;
`;

async function runBenchmark(limit: number) {
  const url = `${process.env.DATABASE_URL}&connection_limit=${limit}&pool_timeout=10`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  
  console.log(`\n--- BENCHMARKING CONNECTION_LIMIT=${limit} ---`);
  
  await prisma.$connect();
  const start = performance.now();
  
  // Simulate 10 concurrent requests (Cache Miss Burst)
  const results = await Promise.all(
    Array.from({ length: 10 }).map(async (_, i) => {
      const qStart = performance.now();
      await prisma.$queryRawUnsafe(AGG_QUERY);
      return performance.now() - qStart;
    })
  );
  
  const total = performance.now() - start;
  const p50 = results.sort((a,b) => a-b)[Math.floor(results.length * 0.5)];
  const p95 = results.sort((a,b) => a-b)[Math.floor(results.length * 0.9)];
  
  console.log(`Total Burst Time (10 concurrent): ${total.toFixed(2)}ms`);
  console.log(`p50 Latency: ${p50.toFixed(2)}ms`);
  console.log(`p95 Latency: ${p95.toFixed(2)}ms`);
  
  await prisma.$disconnect();
  return { limit, total, p50, p95 };
}

async function main() {
  const v3 = await runBenchmark(3);
  const v5 = await runBenchmark(5);
  const v10 = await runBenchmark(10);
  
  console.log('\n--- FINAL COMPARISON ---');
  console.table([v3, v5, v10]);
}

main().catch(console.error);
