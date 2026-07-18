CREATE TYPE "VisaApplicationStatus" AS ENUM ('WAITING_DOCUMENT', 'NEED_REVISION', 'DOCUMENT_VERIFIED', 'WAITING_HOTEL_AGREEMENT', 'PASSENGER_ENTERED', 'GROUP_CREATED', 'READY_TO_SEND', 'VISA_SUBMITTED', 'PAYMENT_COMPLETED', 'VISA_PROCESSING', 'VISA_ISSUED', 'COMPLETED');
CREATE TYPE "VisaApplicationDocumentStatus" AS ENUM ('WAITING_DOCUMENT', 'NEED_REVISION', 'VERIFIED');
CREATE TYPE "VisaApplicationAgreementStatus" AS ENUM ('NOT_STARTED', 'WAITING_APPROVAL', 'APPROVED');
CREATE TYPE "VisaApplicationNusukStatus" AS ENUM ('NOT_STARTED', 'PASSENGER_ENTRY', 'PASSENGER_ENTERED', 'GROUP_CREATED');
CREATE TYPE "VisaApplicationPaymentStatus" AS ENUM ('NOT_STARTED', 'WAITING_PAYMENT', 'COMPLETED');
CREATE TYPE "VisaApplicationVisaStatus" AS ENUM ('NOT_STARTED', 'READY_TO_SEND', 'SUBMITTED', 'PROCESSING', 'ISSUED', 'COMPLETED');
CREATE TYPE "VisaApplicationDocumentType" AS ENUM ('PASSPORT', 'VACCINE_CERTIFICATE', 'MANIFEST', 'PACKAGE_INFORMATION');

CREATE TABLE "VisaApplication" (
  "id" TEXT NOT NULL,
  "applicationNumber" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "createdByPortalUserId" TEXT NOT NULL,
  "departureDate" TIMESTAMP(3) NOT NULL,
  "returnDate" TIMESTAMP(3) NOT NULL,
  "departureCity" TEXT NOT NULL,
  "providerName" TEXT,
  "packageName" TEXT NOT NULL,
  "passengerCount" INTEGER NOT NULL,
  "status" "VisaApplicationStatus" NOT NULL DEFAULT 'WAITING_DOCUMENT',
  "documentStatus" "VisaApplicationDocumentStatus" NOT NULL DEFAULT 'WAITING_DOCUMENT',
  "agreementStatus" "VisaApplicationAgreementStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "nusukStatus" "VisaApplicationNusukStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "paymentStatus" "VisaApplicationPaymentStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "visaStatus" "VisaApplicationVisaStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "nusukGroupNumber" TEXT,
  "nusukReferenceNumber" TEXT,
  "adminNote" TEXT,
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisaApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisaApplicationDocument" (
  "id" TEXT NOT NULL,
  "visaApplicationId" TEXT NOT NULL,
  "type" "VisaApplicationDocumentType" NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" "VisaApplicationDocumentStatus" NOT NULL DEFAULT 'WAITING_DOCUMENT',
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisaApplicationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisaApplication_applicationNumber_key" ON "VisaApplication"("applicationNumber");
CREATE INDEX "VisaApplication_agentId_createdAt_idx" ON "VisaApplication"("agentId", "createdAt" DESC);
CREATE INDEX "VisaApplication_status_updatedAt_idx" ON "VisaApplication"("status", "updatedAt" DESC);
CREATE UNIQUE INDEX "VisaApplicationDocument_visaApplicationId_type_key" ON "VisaApplicationDocument"("visaApplicationId", "type");
CREATE INDEX "VisaApplicationDocument_visaApplicationId_status_idx" ON "VisaApplicationDocument"("visaApplicationId", "status");

ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisaApplication" ADD CONSTRAINT "VisaApplication_createdByPortalUserId_fkey" FOREIGN KEY ("createdByPortalUserId") REFERENCES "AgentPortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisaApplicationDocument" ADD CONSTRAINT "VisaApplicationDocument_visaApplicationId_fkey" FOREIGN KEY ("visaApplicationId") REFERENCES "VisaApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
