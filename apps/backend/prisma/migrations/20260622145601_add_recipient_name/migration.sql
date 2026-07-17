-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;

-- AlterTable
ALTER TABLE "VisaSetup" DROP COLUMN IF EXISTS "outstandingAmount";
