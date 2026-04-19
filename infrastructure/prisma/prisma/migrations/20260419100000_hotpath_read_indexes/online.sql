-- Production-safe rollout for hot-path read indexes.
-- Run this file outside a transaction.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MenuItem_tenantId_sortOrder_idx"
ON "MenuItem" ("tenantId", "sortOrder");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ModifierGroup_menuItemId_sortOrder_idx"
ON "ModifierGroup" ("menuItemId", "sortOrder");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_serviceStaffUserId_createdAt_idx"
ON "Review" ("serviceStaffUserId", "createdAt" DESC);
