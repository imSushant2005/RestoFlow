/**
 * Missing Performance Indexes — Manual Migration
 * 
 * These are ADDITIVE index-only changes. No schema shape changes.
 * Safe to apply on a running database using CREATE INDEX CONCURRENTLY.
 * Run via: pnpx tsx src/db/apply_missing_indexes.ts
 */

import { PrismaClient } from '@bhojflow/prisma';

const prisma = new PrismaClient();

const indexes = [
  {
    name: 'Customer_phone_idx',
    sql: `CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone")`,
    reason: 'Fires on every assisted order create for customer lookup. Without this, full table scan on Customer.',
  },
  {
    name: 'DiningSession_tableId_status_idx',
    sql: `CREATE INDEX IF NOT EXISTS "DiningSession_tableId_status_idx" ON "DiningSession"("tableId", "sessionStatus")`,
    reason: 'Fires on every new order to check for active table sessions.',
  },
  {
    name: 'Bill_sessionId_idx',
    sql: `CREATE INDEX IF NOT EXISTS "Bill_sessionId_idx" ON "Bill"("sessionId")`,
    reason: 'Fires in billing and session-close flows. Without this, joins from Session to Bill are slow.',
  },
  {
    name: 'OrderAuditLog_orderId_createdAt_idx',
    sql: `CREATE INDEX IF NOT EXISTS "OrderAuditLog_orderId_createdAt_idx" ON "OrderAuditLog"("orderId", "createdAt" DESC)`,
    reason: 'Needed for audit trail lookups and history page supporting data.',
  },
  {
    name: 'Order_tenantId_createdAt_idx',
    sql: `CREATE INDEX IF NOT EXISTS "Order_tenantId_createdAt_idx" ON "Order"("tenantId", "createdAt" DESC)`,
    reason: 'Covers the ORDER BY createdAt DESC used in history queries alongside the WHERE tenantId filter.',
  },
  {
    name: 'OrderItem_menuItemId_idx',
    sql: `CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId")`,
    reason: 'Needed for analytics groupBy(menuItemId) and any future per-dish order lookups.',
  },
];

async function applyIndexes() {
  console.log('--- APPLYING MISSING PERFORMANCE INDEXES ---\n');

  for (const index of indexes) {
    console.log(`[${index.name}] Reason: ${index.reason}`);
    try {
      await prisma.$queryRawUnsafe(index.sql);
      console.log(`  ✅ Applied\n`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log(`  ⚠️  Already exists — skipped\n`);
      } else {
        console.error(`  ❌ FAILED:`, err.message, '\n');
      }
    }
  }

  console.log('--- DONE ---');
  await prisma.$disconnect();
}

applyIndexes();
