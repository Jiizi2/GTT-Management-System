ALTER TABLE "Invoice" ADD COLUMN "agentId" TEXT;
UPDATE "Invoice" i SET "agentId" = g."agentId" FROM "Group" g WHERE i."groupId" = g."id";
UPDATE "Invoice" SET "agentId" = (SELECT "id" FROM "Agent" WHERE "code" = 'GTT-DIRECT') WHERE "agentId" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "agentId" SET NOT NULL;
CREATE INDEX "Invoice_agentId_status_dueDate_idx" ON "Invoice"("agentId", "status", "dueDate" DESC);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
