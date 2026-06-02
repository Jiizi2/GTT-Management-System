-- CreateTable
CREATE TABLE "HotelAgreementDraft" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "city" "AgreementCity" NOT NULL,
    "agentName" TEXT,
    "hotelName" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "pax" INTEGER NOT NULL,
    "status" "AgreementApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "stayStart" TIMESTAMP(3) NOT NULL,
    "stayEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelAgreementDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelAgreementDraft_groupId_idx" ON "HotelAgreementDraft"("groupId");

-- CreateIndex
CREATE INDEX "HotelAgreementDraft_agreementNumber_idx" ON "HotelAgreementDraft"("agreementNumber");

-- CreateIndex
CREATE INDEX "HotelAgreementDraft_city_stayStart_idx" ON "HotelAgreementDraft"("city", "stayStart");

-- AddForeignKey
ALTER TABLE "HotelAgreementDraft" ADD CONSTRAINT "HotelAgreementDraft_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
