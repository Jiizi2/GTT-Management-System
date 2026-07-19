BEGIN;

ALTER TABLE "HotelAgreementDraft" ADD COLUMN "agentId" TEXT;

-- Keep the legacy snapshot and its relational assignment in one transaction.
-- The ALTER TABLE lock prevents an old application instance from inserting a
-- draft between agent discovery and assignment while this migration runs.
WITH "LegacyAgents" AS (
    SELECT DISTINCT ON (LOWER(BTRIM("agentName")))
        LOWER(BTRIM("agentName")) AS "normalizedName",
        BTRIM("agentName") AS "displayName"
    FROM "HotelAgreementDraft"
    WHERE NULLIF(BTRIM("agentName"), '') IS NOT NULL
    ORDER BY LOWER(BTRIM("agentName")), BTRIM("agentName")
)
INSERT INTO "Agent" ("id", "code", "name", "type", "status")
SELECT
    'agent_legacy_' || MD5("normalizedName"),
    'LEGACY-' || UPPER(SUBSTRING(MD5("normalizedName") FROM 1 FOR 16)),
    "displayName",
    'PARTNER'::"AgentType",
    'ACTIVE'::"AgentStatus"
FROM "LegacyAgents"
WHERE "normalizedName" <> 'gtt direct'
ON CONFLICT ("code") DO NOTHING;

UPDATE "HotelAgreementDraft"
SET "agentId" = CASE
    WHEN NULLIF(BTRIM("agentName"), '') IS NULL
        OR LOWER(BTRIM("agentName")) = 'gtt direct'
    THEN (SELECT "id" FROM "Agent" WHERE "code" = 'GTT-DIRECT')
    ELSE 'agent_legacy_' || MD5(LOWER(BTRIM("agentName")))
END
WHERE "agentId" IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "HotelAgreementDraft" draft
        LEFT JOIN "Agent" agent ON agent."id" = draft."agentId"
        WHERE NULLIF(BTRIM(draft."agentName"), '') IS NOT NULL
          AND (
              agent."id" IS NULL
              OR LOWER(BTRIM(agent."name")) <> LOWER(BTRIM(draft."agentName"))
          )
    ) THEN
        RAISE EXCEPTION 'Legacy hotel agreement agent backfill verification failed.';
    END IF;
END $$;

ALTER TABLE "HotelAgreementDraft" ALTER COLUMN "agentId" SET NOT NULL;
CREATE INDEX "HotelAgreementDraft_agentId_city_stayStart_idx" ON "HotelAgreementDraft"("agentId", "city", "stayStart");
ALTER TABLE "HotelAgreementDraft" ADD CONSTRAINT "HotelAgreementDraft_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
