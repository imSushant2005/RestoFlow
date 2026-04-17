WITH ranked_active_sessions AS (
  SELECT
    id,
    "tenantId",
    "tableId",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "tableId"
      ORDER BY "openedAt" DESC, id DESC
    ) AS row_rank
  FROM "DiningSession"
  WHERE "tableId" IS NOT NULL
    AND "sessionStatus" NOT IN ('CLOSED', 'CANCELLED')
),
duplicate_active_sessions AS (
  SELECT id
  FROM ranked_active_sessions
  WHERE row_rank > 1
)
UPDATE "DiningSession" AS session
SET
  "sessionStatus" = 'CANCELLED',
  "closedAt" = COALESCE(session."closedAt", NOW())
FROM duplicate_active_sessions AS duplicate
WHERE session.id = duplicate.id;

UPDATE "Table" AS table_ref
SET "currentSessionId" = ranked.id
FROM (
  SELECT DISTINCT ON ("tenantId", "tableId")
    id,
    "tenantId",
    "tableId"
  FROM "DiningSession"
  WHERE "tableId" IS NOT NULL
    AND "sessionStatus" NOT IN ('CLOSED', 'CANCELLED')
  ORDER BY "tenantId", "tableId", "openedAt" DESC, id DESC
) AS ranked
WHERE table_ref.id = ranked."tableId";

CREATE UNIQUE INDEX "DiningSession_active_table_session_uidx"
ON "DiningSession" ("tenantId", "tableId")
WHERE "tableId" IS NOT NULL
  AND "sessionStatus" NOT IN ('CLOSED', 'CANCELLED');
