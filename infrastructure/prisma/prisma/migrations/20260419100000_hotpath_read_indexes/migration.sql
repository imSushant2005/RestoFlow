CREATE INDEX IF NOT EXISTS "MenuItem_tenantId_sortOrder_idx"
ON "MenuItem" ("tenantId", "sortOrder");

CREATE INDEX IF NOT EXISTS "ModifierGroup_menuItemId_sortOrder_idx"
ON "ModifierGroup" ("menuItemId", "sortOrder");

CREATE INDEX IF NOT EXISTS "Review_serviceStaffUserId_createdAt_idx"
ON "Review" ("serviceStaffUserId", "createdAt" DESC);
