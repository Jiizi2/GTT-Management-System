-- DropIndex
DROP INDEX "ChecklistDriver_checklistAssignmentId_idx";

-- DropIndex
DROP INDEX "GroupTimelineItem_groupId_sortOrder_idx";

-- DropIndex
DROP INDEX "InvoiceItem_invoiceId_idx";

-- DropIndex
DROP INDEX "ItineraryItem_groupId_sortOrder_idx";

-- CreateIndex
CREATE INDEX "ChecklistAssignment_itineraryItemId_idx" ON "ChecklistAssignment"("itineraryItemId");

-- CreateIndex
CREATE INDEX "Group_parentGroupId_idx" ON "Group"("parentGroupId");

-- CreateIndex
CREATE INDEX "Group_searchDocument_idx" ON "Group" USING GIN ("searchDocument" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "InvoiceClient_groupId_idx" ON "InvoiceClient"("groupId");

-- CreateIndex
CREATE INDEX "ItineraryItem_isoDate_idx" ON "ItineraryItem"("isoDate");
