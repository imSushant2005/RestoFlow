import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkState() {
  try {
    const [orders, orderItems, tenants, analytics] = await Promise.all([
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.tenant.count(),
      prisma.dailyAnalytics.count()
    ]);

    console.log('--- DATABASE STATE ---');
    console.log(`Tenants: ${tenants}`);
    console.log(`Orders: ${orders}`);
    console.log(`OrderItems: ${orderItems}`);
    console.log(`DailyAnalytics: ${analytics}`);
    
    if (orders > 0) {
      const tenant = await prisma.order.findFirst({ select: { tenantId: true } });
      const tid = tenant?.tenantId;
      console.log(`Sample Tenant ID: ${tid}`);
      
      console.log('\n--- EXPLAIN ANALYZE: NEW COMPOSITE INDEX ---');
      const explain = await prisma.$queryRawUnsafe(`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT COUNT(*) FROM "Order" 
        WHERE "tenantId" = '${tid}' 
          AND "status" = 'RECEIVED' 
          AND "createdAt" >= '2020-01-01'
      `);
      console.log(JSON.stringify(explain, null, 2));
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkState();
