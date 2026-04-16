import { PrismaClient } from '@dineflow/prisma';

async function main() {
  const prisma = new PrismaClient();
  console.log('--- APPLYING PERFORMANCE INDEX MANUALLY ---');
  
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Order_history_board_idx" 
      ON "Order"("tenantId", "status", "createdAt" DESC);
    `);
    console.log('✅ Index "Order_history_board_idx" created (or already exists).');
  } catch (error) {
    console.error('❌ Failed to apply index:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
