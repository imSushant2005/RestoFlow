import { prisma } from '../src/db/prisma';

async function deepTrace() {
  console.log('--- STARTING DEEP INFRASTRUCTURE TRACE ---');
  
  // 1. Measure Prisma Client Init (Binary/Library load)
  const startInit = performance.now();
  // accessing internal engine to force boot if possible, or just first call
  const initTime = performance.now() - startInit;
  console.log(`Prisma Client Init: ${initTime.toFixed(2)}ms`);

  // 2. Measure TCP/TLS + Pool Acquisition (The "Cold Connect")
  const startConnect = performance.now();
  await prisma.$connect();
  const connectTime = performance.now() - startConnect;
  console.log(`TCP/TLS/Handshake + Pool Connect: ${connectTime.toFixed(2)}ms`);

  // 3. Measure First Query Exec vs Roundtrip
  const startQ1 = performance.now();
  let dbTime = 0;
  (prisma as any).$on('query', (e: any) => {
    dbTime = e.duration;
  });
  
  await prisma.$queryRaw`SELECT 1`;
  const roundtrip = performance.now() - startQ1;
  console.log(`First Query Total: ${roundtrip.toFixed(2)}ms`);
  console.log(`  - DB Internal: ${dbTime}ms`);
  console.log(`  - Link/Wire Overhead: ${(roundtrip - dbTime).toFixed(2)}ms`);

  // 4. Sequential Query to check Pool Reuse
  const startQ2 = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const roundtrip2 = performance.now() - startQ2;
  console.log(`Second Query (Reused Pool): ${roundtrip2.toFixed(2)}ms`);
  console.log(`  - Link/Wire Overhead: ${(roundtrip2 - dbTime).toFixed(2)}ms`);

}

process.env.NODE_ENV = 'development';
deepTrace().catch(console.error).finally(() => prisma.$disconnect());
