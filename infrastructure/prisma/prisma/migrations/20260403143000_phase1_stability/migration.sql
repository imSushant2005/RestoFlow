-- Phase 1 stability migration:
-- 1) Standardize Bill financial fields
-- 2) Remove legacy CustomerSession dependency from Order flow

-- Bill normalization
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION;

UPDATE "Bill"
SET
  "taxAmount" = COALESCE("taxAmount", COALESCE("cgst", 0) + COALESCE("sgst", 0)),
  "discountAmount" = COALESCE("discountAmount", COALESCE("itemDiscount", 0)),
  "totalAmount" = COALESCE(
    "totalAmount",
    COALESCE(
      "grandTotal",
      "subtotal" + COALESCE("cgst", 0) + COALESCE("sgst", 0) + COALESCE("serviceCharge", 0) - COALESCE("itemDiscount", 0)
    )
  );

ALTER TABLE "Bill" ALTER COLUMN "totalAmount" SET NOT NULL;

ALTER TABLE "Bill" DROP COLUMN IF EXISTS "itemDiscount";
ALTER TABLE "Bill" DROP COLUMN IF EXISTS "taxableAmount";
ALTER TABLE "Bill" DROP COLUMN IF EXISTS "cgst";
ALTER TABLE "Bill" DROP COLUMN IF EXISTS "sgst";
ALTER TABLE "Bill" DROP COLUMN IF EXISTS "serviceCharge";
ALTER TABLE "Bill" DROP COLUMN IF EXISTS "roundOff";
ALTER TABLE "Bill" DROP COLUMN IF EXISTS "grandTotal";

-- Remove legacy CustomerSession-based order linking
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_sessionId_fkey";
DROP INDEX IF EXISTS "Order_sessionId_idx";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "sessionId";

DROP TABLE IF EXISTS "CustomerSession" CASCADE;
