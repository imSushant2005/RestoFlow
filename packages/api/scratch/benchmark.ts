import { prisma } from '../src/db/prisma';

async function benchmark() {
  const tenantId = 'cl...'; // I'll need a real ID or just mock one
  console.log('Benchmarking Analytics Queries...');

  const start = Date.now();
  // Typical dashboard aggregate
  const result = await prisma.order.aggregate({
    where: {
      tenantId: 'mock-id',
      status: 'RECEIVED' as any,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    },
    _sum: { totalAmount: true }
  });
  console.log(`Aggregate Sum: ${Date.now() - start}ms`);

  const start2 = Date.now();
  // Grouping items (Join logic)
  await prisma.orderItem.groupBy({
    by: ['name'],
    where: {
      order: {
        tenantId: 'mock-id',
        status: 'RECEIVED' as any,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    _sum: { quantity: true }
  });
  console.log(`OrderItem GroupBy: ${Date.now() - start2}ms`);
}

// Just a template, won't run without valid data
console.log('Script template created for performance validation.');
