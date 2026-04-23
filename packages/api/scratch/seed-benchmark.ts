import { prisma } from '../src/db/prisma';

async function seed() {
  console.log('--- STARTING BENCHMARK SEEDING ---');
  const tenantSlug = 'benchmark-tenant-' + Date.now();
  
  const tenant = await prisma.tenant.create({
    data: {
      slug: tenantSlug,
      businessName: 'Benchmark Performance Lab',
      email: 'perf@BHOJFLOW.com',
      plan: 'PREMIUM',
      isActive: true,
    }
  });

  console.log(`Target Tenant Created: ${tenant.id} (${tenant.id})`);

  // Create some menu items for grouping
  const category = await prisma.category.create({
     data: { tenantId: tenant.id, name: 'Main Course' }
  });

  const menuItems = await Promise.all([
    prisma.menuItem.create({ data: { tenantId: tenant.id, categoryId: category.id, name: 'Pizza', price: 500 } }),
    prisma.menuItem.create({ data: { tenantId: tenant.id, categoryId: category.id, name: 'Burger', price: 400 } }),
    prisma.menuItem.create({ data: { tenantId: tenant.id, categoryId: category.id, name: 'Pasta', price: 600 } }),
  ]);

  const BATCH_SIZE = 100;
  const TOTAL_ORDERS = 5000;
  const batches = TOTAL_ORDERS / BATCH_SIZE;

  console.log(`Seeding ${TOTAL_ORDERS} orders in ${batches} batches...`);

  for (let b = 0; b < batches; b++) {
    const orders = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

      orders.push(
        prisma.order.create({
          data: {
            tenantId: tenant.id,
            orderNumber: `BENCH-${b}-${i}`,
            status: 'RECEIVED' as any,
            subtotal: 1000,
            totalAmount: 1100,
            createdAt: date,
            items: {
              create: [
                {
                   name: menuItems[i % 3].name,
                   menuItemId: menuItems[i % 3].id,
                   quantity: 1,
                   unitPrice: 1000,
                   totalPrice: 1000,
                   selectedModifiers: [],
                   createdAt: date
                }
              ]
            }
          }
        })
      );
    }
    await Promise.all(orders);
    process.stdout.write('.');
  }

  console.log('\n--- SEEDING COMPLETE ---');
  console.log(`Tenant ID for Benchmark: ${tenant.id}`);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
