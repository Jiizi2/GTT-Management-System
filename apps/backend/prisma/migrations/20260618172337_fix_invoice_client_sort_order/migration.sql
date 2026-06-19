-- DropIndex
DROP INDEX "InvoiceClient_sortOrder_key";

-- CreateIndex
CREATE INDEX "InvoiceClient_sortOrder_idx" ON "InvoiceClient"("sortOrder");
