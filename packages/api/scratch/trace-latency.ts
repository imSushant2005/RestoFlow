import { prisma } from '../src/db/prisma';

const tid = 'cmo4gpttk0000sk3792v3a9f9';

async function traceLatency() {
  console.log('--- STARTING TRACE ---');
  
  const startTotal = performance.now();
  
  // 1. Connection Acquisition + First Query
  const startQ1 = performance.now();
  await prisma.tenant.findUnique({ where: { id: tid } });
  const q1Time = performance.now() - startQ1;
  console.log(`Connection + Q1 (Tenant Lookup): ${q1Time.toFixed(2)}ms`);

  // 2. Sequential Query 2 (Measure purely the roundtrip/exec)
  const startQ2 = performance.now();
  await prisma.order.count({ where: { tenantId: tid } });
  const q2Time = performance.now() - startQ2;
  console.log(`Q2 (Order Count - Roundtrip): ${q2Time.toFixed(2)}ms`);

  // 3. Sequential Query 3
  const startQ3 = performance.now();
  await prisma.menuItem.count({ where: { tenantId: tid } });
  const q3Time = performance.now() - startQ3;
  console.log(`Q3 (Menu Count - Roundtrip): ${q3Time.toFixed(2)}ms`);

  const total = performance.now() - startTotal;
  console.log(`Total Traced Time: ${total.toFixed(2)}ms`);
}

traceLatency().catch(console.error).finally(() => prisma.$disconnect());
