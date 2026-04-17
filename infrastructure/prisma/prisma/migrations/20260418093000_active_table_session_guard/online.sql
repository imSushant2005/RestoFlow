-- Production-safe rollout for the active dining-session guard.
-- Run this file outside a transaction after the backend code that catches
-- unique-conflict races has already been deployed.

WITH ranked_sessions AS (
  SELECT
    id,
    "tenantId",
    "tableId",
    "sessionStatus",
    "openedAt",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "tableId"
      ORDER BY "openedAt" DESC, id DESC
    ) AS row_num
  FROM "DiningSession"
  WHERE "tableId" IS NOT NULL
    AND "sessionStatus" NOT IN ('CLOSED', 'CANCELLED')
),
duplicate_sessions AS (
  SELECT id
  FROM ranked_sessions
  WHERE row_num > 1
)
UPDATE "DiningSession"
SET
  "sessionStatus" = 'CANCELLED',
  "closedAt" = COALESCE("closedAt", NOW())
WHERE id IN (SELECT id FROM duplicate_sessions);

WITH surviving_sessions AS (
  SELECT DISTINCT ON ("tenantId", "tableId")
    id,
    "tenantId",
    "tableId"
  FROM "DiningSession"
  WHERE "tableId" IS NOT NULL
    AND "sessionStatus" NOT IN ('CLOSED', 'CANCELLED')
  ORDER BY "tenantId", "tableId", "openedAt" DESC, id DESC
)
UPDATE "Table" AS t
SET "currentSessionId" = surviving.id
FROM surviving_sessions AS surviving
WHERE t.id = surviving."tableId"
  AND t."tenantId" = surviving."tenantId"
  AND t."currentSessionId" IS DISTINCT FROM surviving.id;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "DiningSession_active_table_session_uidx"
ON "DiningSession" ("tenantId", "tableId")
WHERE "tableId" IS NOT NULL
  AND "sessionStatus" NOT IN ('CLOSED', 'CANCELLED');
