-- PHASE 1: Rename ALL duplicates (keep only the very first by createdAt, rename all others)
-- Run this in the Neon SQL console or any Postgres client connected to your Neondb.

-- First: see how many duplicates we have
SELECT
  "tenantId",
  "orderNumber",
  COUNT(*) AS total_copies,
  MIN("createdAt") AS first_created,
  MAX("createdAt") AS last_created
FROM "Order"
GROUP BY "tenantId", "orderNumber"
HAVING COUNT(*) > 1
ORDER BY total_copies DESC;

-- Then run the fix: append -DX{rownum} to all non-first duplicates
-- This is idempotent-safe: orders that were already renamed (have -DX) won't be in the partition
WITH ranked AS (
  SELECT
    id,
    "orderNumber",
    "tenantId",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "orderNumber"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Order"
),
dupes AS (
  SELECT id, "orderNumber", rn
  FROM ranked
  WHERE rn > 1
)
UPDATE "Order"
SET "orderNumber" = CONCAT(dupes."orderNumber", '-DX', dupes.rn::TEXT, SUBSTRING("Order".id, 1, 4))
FROM dupes
WHERE "Order".id = dupes.id;

-- Verify: should return 0 rows
SELECT "tenantId", "orderNumber", COUNT(*) AS cnt
FROM "Order"
GROUP BY "tenantId", "orderNumber"
HAVING COUNT(*) > 1;
