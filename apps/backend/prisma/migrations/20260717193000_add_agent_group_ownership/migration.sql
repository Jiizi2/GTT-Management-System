CREATE TYPE "AgentType" AS ENUM ('DIRECT', 'PARTNER');
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AgentType" NOT NULL DEFAULT 'PARTNER',
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "picName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agent_code_key" ON "Agent"("code");
CREATE INDEX "Agent_name_idx" ON "Agent"("name");
CREATE INDEX "Agent_status_type_idx" ON "Agent"("status", "type");

INSERT INTO "Agent" ("id", "code", "name", "type", "status")
VALUES ('agent_gtt_direct', 'GTT-DIRECT', 'GTT Direct', 'DIRECT', 'ACTIVE')
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "Group" ADD COLUMN "agentId" TEXT;
UPDATE "Group" SET "agentId" = (SELECT "id" FROM "Agent" WHERE "code" = 'GTT-DIRECT') WHERE "agentId" IS NULL;
ALTER TABLE "Group" ALTER COLUMN "agentId" SET NOT NULL;
CREATE INDEX "Group_agentId_lifecycleStatus_arrivalDate_idx" ON "Group"("agentId", "lifecycleStatus", "arrivalDate");
ALTER TABLE "Group" ADD CONSTRAINT "Group_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
