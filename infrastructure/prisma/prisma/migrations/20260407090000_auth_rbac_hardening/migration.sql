-- Auth/RBAC hardening: unique credentials + first-login password policy + Clerk sync fields

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "employeeCode" TEXT,
  ADD COLUMN IF NOT EXISTS "clerkUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "securityQuestion" TEXT,
  ADD COLUMN IF NOT EXISTS "securityAnswerHash" TEXT;

ALTER TABLE "User"
  DROP CONSTRAINT IF EXISTS "User_tenantId_email_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_email_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_employeeCode_key" ON "User"("employeeCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkUserId_key" ON "User"("clerkUserId");
CREATE INDEX IF NOT EXISTS "User_tenantId_role_idx" ON "User"("tenantId", "role");
