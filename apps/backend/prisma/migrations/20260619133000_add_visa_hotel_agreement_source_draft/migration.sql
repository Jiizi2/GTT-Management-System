-- AlterTable
ALTER TABLE "VisaHotelAgreement" ADD COLUMN "sourceDraftId" TEXT;

-- CreateIndex
CREATE INDEX "VisaHotelAgreement_sourceDraftId_idx" ON "VisaHotelAgreement"("sourceDraftId");

-- AddForeignKey
ALTER TABLE "VisaHotelAgreement" ADD CONSTRAINT "VisaHotelAgreement_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "HotelAgreementDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
