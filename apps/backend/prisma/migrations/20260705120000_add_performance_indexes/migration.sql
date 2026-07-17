-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;

-- AlterTable
ALTER TABLE "VisaSetup" DROP COLUMN IF EXISTS "outstandingAmount";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Group_searchDocument_lifecycleStatus_idx" ON "Group"("searchDocument", "lifecycleStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_description_idx" ON "InvoiceItem"("invoiceId", "description");
