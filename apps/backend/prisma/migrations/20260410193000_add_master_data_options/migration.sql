CREATE TABLE "MasterDataOption" (
  "id" TEXT NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "sortOrder" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MasterDataOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MasterDataOption_categoryKey_value_key" ON "MasterDataOption"("categoryKey", "value");
CREATE INDEX "MasterDataOption_categoryKey_sortOrder_idx" ON "MasterDataOption"("categoryKey", "sortOrder");
CREATE INDEX "MasterDataOption_categoryKey_isActive_idx" ON "MasterDataOption"("categoryKey", "isActive");
