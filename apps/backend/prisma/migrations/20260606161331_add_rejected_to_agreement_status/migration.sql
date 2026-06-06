-- AlterEnum
ALTER TYPE "AgreementApprovalStatus" ADD VALUE 'REJECTED';

-- Re-create trigram index if missing/dropped
CREATE INDEX IF NOT EXISTS "Group_searchDocument_trgm_idx" ON "Group" USING GIN ("searchDocument" gin_trgm_ops);
