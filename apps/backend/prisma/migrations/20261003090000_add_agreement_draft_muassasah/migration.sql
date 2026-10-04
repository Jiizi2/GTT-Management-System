ALTER TABLE "HotelAgreementDraft" ADD COLUMN "muassasahId" TEXT;

CREATE INDEX "HotelAgreementDraft_muassasahId_idx" ON "HotelAgreementDraft"("muassasahId");

ALTER TABLE "HotelAgreementDraft" ADD CONSTRAINT "HotelAgreementDraft_muassasahId_fkey"
FOREIGN KEY ("muassasahId") REFERENCES "Muassasah"("id") ON DELETE SET NULL ON UPDATE CASCADE;
