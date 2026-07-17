ALTER TABLE "HotelAgreementDraft" ADD COLUMN "agentId" TEXT;
UPDATE "HotelAgreementDraft" SET "agentId" = (SELECT "id" FROM "Agent" WHERE "code" = 'GTT-DIRECT') WHERE "agentId" IS NULL;
ALTER TABLE "HotelAgreementDraft" ALTER COLUMN "agentId" SET NOT NULL;
CREATE INDEX "HotelAgreementDraft_agentId_city_stayStart_idx" ON "HotelAgreementDraft"("agentId", "city", "stayStart");
ALTER TABLE "HotelAgreementDraft" ADD CONSTRAINT "HotelAgreementDraft_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
