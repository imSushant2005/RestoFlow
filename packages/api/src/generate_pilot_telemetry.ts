import { PrismaClient } from '@dineflow/prisma';

const prisma = new PrismaClient();
const PILOT_TENANT_ID = 'cmnocfczm0001o6bnjq98qw8e'; // Venue #1 (aura cafe)

async function generateReport() {
  console.log('--- STAGE 1 PILOT TELEMETRY REPORT ---');
  console.log('Venue: aura cafe');
  console.log(`Snapshot Time: ${new Date().toLocaleString()}\n`);

  // 1. Transaction Status Distribution
  const counts = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
    where: { tenantId: PILOT_TENANT_ID }
  });
  console.log('[Metric] Current Board Distribution:', JSON.stringify(counts, null, 2));

  // 2. Audit Log Latency Analysis (Estimated from transition timestamps)
  // Note: For real P95s, we would parse the pino-http logs for the /status endpoint.
  // Here we check the Audit log density.
  const auditCount = await prisma.orderAuditLog.count({
    where: { tenantId: PILOT_TENANT_ID, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
  });
  console.log(`\n[Metric] Audit Logs (Last 24h): ${auditCount}`);

  // 3. Collision / Conflict Watch
  const auditLogs = await prisma.orderAuditLog.findMany({
    where: { 
      tenantId: PILOT_TENANT_ID,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    select: { reasonCode: true, metadata: true }
  });

  const collisions = auditLogs.filter(log => log.reasonCode === 'OCC_CONFLICT' || (log.metadata as any)?.type === 'OCC_CONFLICT').length;
  console.log(`[Metric] OCC Conflicts Observed: ${collisions}`);

  // 4. Identification of Slow Creation Path (Outliers)
  const slowUpdates = await prisma.orderAuditLog.findMany({
    where: { 
      tenantId: PILOT_TENANT_ID,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  console.log('\n--- NEXT STEPS ---');
  console.log('1. Wait for Dinner Peak (End of Day).');
  console.log('2. Parse pino-http stdout for specific responseTime P95s.');
  console.log('3. Compare outlier patterns against optimized write-paths.');

  await prisma.$disconnect();
}

generateReport().catch(console.error);
