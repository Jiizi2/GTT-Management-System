-- CreateEnum
CREATE TYPE "GroupLifecycleStatus" AS ENUM ('ENTRY_ONLY', 'ACTIVE', 'INACTIVE', 'COMPLETED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "lifecycleStatus" "GroupLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill existing free-text status values into the explicit lifecycle contract.
UPDATE "Group"
SET "lifecycleStatus" = CASE
  WHEN lower(regexp_replace("status", '[^a-zA-Z0-9]+', '', 'g')) = 'entryonly' THEN 'ENTRY_ONLY'::"GroupLifecycleStatus"
  WHEN lower(regexp_replace("status", '[^a-zA-Z0-9]+', '', 'g')) IN ('inactive', 'inaktif') THEN 'INACTIVE'::"GroupLifecycleStatus"
  WHEN lower(regexp_replace("status", '[^a-zA-Z0-9]+', '', 'g')) IN ('completed', 'complete') THEN 'COMPLETED'::"GroupLifecycleStatus"
  WHEN lower(regexp_replace("status", '[^a-zA-Z0-9]+', '', 'g')) IN ('archived', 'archive') THEN 'ARCHIVED'::"GroupLifecycleStatus"
  ELSE 'ACTIVE'::"GroupLifecycleStatus"
END;

-- CreateIndex
CREATE INDEX "Group_lifecycleStatus_idx" ON "Group"("lifecycleStatus");
