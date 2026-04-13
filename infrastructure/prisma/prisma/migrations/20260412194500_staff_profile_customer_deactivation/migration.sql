ALTER TABLE "User"
ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "Customer"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deactivatedAt" TIMESTAMP(3),
ADD COLUMN "anonymizedAt" TIMESTAMP(3);

ALTER TABLE "Review"
ADD COLUMN "serviceStaffUserId" TEXT;

ALTER TABLE "Review"
ADD CONSTRAINT "Review_serviceStaffUserId_fkey"
FOREIGN KEY ("serviceStaffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "User_tenantId_isActive_idx" ON "User"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "Customer_isActive_idx" ON "Customer"("isActive");
CREATE INDEX IF NOT EXISTS "DiningSession_tenantId_tableId_openedAt_idx" ON "DiningSession"("tenantId", "tableId", "openedAt");
CREATE INDEX IF NOT EXISTS "DiningSession_tenantId_tableId_sessionStatus_openedAt_idx" ON "DiningSession"("tenantId", "tableId", "sessionStatus", "openedAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_diningSessionId_status_createdAt_idx" ON "Order"("tenantId", "diningSessionId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_diningSessionId_createdAt_idx" ON "Order"("diningSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "Review_serviceStaffUserId_idx" ON "Review"("serviceStaffUserId");
