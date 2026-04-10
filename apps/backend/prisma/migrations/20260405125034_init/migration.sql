-- CreateEnum
CREATE TYPE "GroupTone" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('DRAFT', 'PENDING', 'ISSUED');

-- CreateEnum
CREATE TYPE "VisaPaymentStatus" AS ENUM ('PAID', 'UNPAID', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AgreementApprovalStatus" AS ENUM ('WAITING', 'APPROVED');

-- CreateEnum
CREATE TYPE "AgreementCity" AS ENUM ('MAKKAH', 'MADINAH');

-- CreateEnum
CREATE TYPE "GroupRaudhahStatus" AS ENUM ('FREE', 'AFTER', 'BEFORE');

-- CreateEnum
CREATE TYPE "ChecklistAssignmentStatus" AS ENUM ('NOT_COMPLETE', 'ASSIGNED');

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tone" "GroupTone" NOT NULL DEFAULT 'ACTIVE',
    "pax" INTEGER NOT NULL,
    "totalBuses" INTEGER,
    "packageName" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Musyrif" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Musyrif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextActivity" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "timeLabel" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NextActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTimelineItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "nextActivity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupTimelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "yearLabel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryKey" TEXT,
    "title" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "isoDate" TIMESTAMP(3),
    "time" TEXT,
    "flightNumber" TEXT,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "cityTourCity" TEXT,
    "requiresBus" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "transferByTrain" BOOLEAN NOT NULL DEFAULT false,
    "trainDepartureTime" TEXT,
    "destinationPickupTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupNote" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaSetup" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "visaStatus" "VisaStatus" NOT NULL DEFAULT 'DRAFT',
    "syarikah" TEXT NOT NULL,
    "paymentStatus" "VisaPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "outstandingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaHotelAgreement" (
    "id" TEXT NOT NULL,
    "visaSetupId" TEXT NOT NULL,
    "city" "AgreementCity" NOT NULL,
    "hotelName" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "pax" INTEGER NOT NULL,
    "status" "AgreementApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "stayStart" TIMESTAMP(3) NOT NULL,
    "stayEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaHotelAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaudhahAppointment" (
    "id" TEXT NOT NULL,
    "visaSetupId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "GroupRaudhahStatus" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaudhahAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistAssignment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "itineraryItemId" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "activity" TEXT NOT NULL,
    "tripLabel" TEXT NOT NULL,
    "requiredBusCount" INTEGER NOT NULL DEFAULT 1,
    "scheduledTime" TEXT NOT NULL,
    "transferByTrain" BOOLEAN NOT NULL DEFAULT false,
    "trainDepartureTime" TEXT,
    "stationPickupTime" TEXT,
    "status" "ChecklistAssignmentStatus" NOT NULL DEFAULT 'NOT_COMPLETE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistDriver" (
    "id" TEXT NOT NULL,
    "checklistAssignmentId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_code_key" ON "Group"("code");

-- CreateIndex
CREATE INDEX "Group_createdAt_idx" ON "Group"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Musyrif_groupId_key" ON "Musyrif"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "NextActivity_groupId_key" ON "NextActivity"("groupId");

-- CreateIndex
CREATE INDEX "GroupTimelineItem_groupId_sortOrder_idx" ON "GroupTimelineItem"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GroupTimelineItem_groupId_sortOrder_key" ON "GroupTimelineItem"("groupId", "sortOrder");

-- CreateIndex
CREATE INDEX "ItineraryItem_groupId_sortOrder_idx" ON "ItineraryItem"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ItineraryItem_groupId_sortOrder_key" ON "ItineraryItem"("groupId", "sortOrder");

-- CreateIndex
CREATE INDEX "GroupNote_groupId_sortOrder_idx" ON "GroupNote"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VisaSetup_groupId_key" ON "VisaSetup"("groupId");

-- CreateIndex
CREATE INDEX "VisaHotelAgreement_visaSetupId_city_stayStart_idx" ON "VisaHotelAgreement"("visaSetupId", "city", "stayStart");

-- CreateIndex
CREATE INDEX "RaudhahAppointment_visaSetupId_date_idx" ON "RaudhahAppointment"("visaSetupId", "date");

-- CreateIndex
CREATE INDEX "ChecklistAssignment_groupId_tripDate_idx" ON "ChecklistAssignment"("groupId", "tripDate");

-- CreateIndex
CREATE INDEX "ChecklistDriver_checklistAssignmentId_idx" ON "ChecklistDriver"("checklistAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistDriver_checklistAssignmentId_slotNumber_key" ON "ChecklistDriver"("checklistAssignmentId", "slotNumber");

-- AddForeignKey
ALTER TABLE "Musyrif" ADD CONSTRAINT "Musyrif_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextActivity" ADD CONSTRAINT "NextActivity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTimelineItem" ADD CONSTRAINT "GroupTimelineItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupNote" ADD CONSTRAINT "GroupNote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaSetup" ADD CONSTRAINT "VisaSetup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaHotelAgreement" ADD CONSTRAINT "VisaHotelAgreement_visaSetupId_fkey" FOREIGN KEY ("visaSetupId") REFERENCES "VisaSetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaudhahAppointment" ADD CONSTRAINT "RaudhahAppointment_visaSetupId_fkey" FOREIGN KEY ("visaSetupId") REFERENCES "VisaSetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAssignment" ADD CONSTRAINT "ChecklistAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAssignment" ADD CONSTRAINT "ChecklistAssignment_itineraryItemId_fkey" FOREIGN KEY ("itineraryItemId") REFERENCES "ItineraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistDriver" ADD CONSTRAINT "ChecklistDriver_checklistAssignmentId_fkey" FOREIGN KEY ("checklistAssignmentId") REFERENCES "ChecklistAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
