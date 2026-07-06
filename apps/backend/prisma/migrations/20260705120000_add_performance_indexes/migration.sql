-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "recipientName" TEXT;

-- AlterTable
ALTER TABLE "VisaSetup" DROP COLUMN "outstandingAmount";

-- CreateIndex
CREATE INDEX "Group_searchDocument_lifecycleStatus_idx" ON "Group"("searchDocument", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate" DESC);

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_description_idx" ON "InvoiceItem"("invoiceId", "description");
