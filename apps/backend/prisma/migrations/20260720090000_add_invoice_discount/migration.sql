ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "discountIdr" DECIMAL(12,2);

UPDATE "Invoice"
SET "discountIdr" = 0
WHERE "discountIdr" IS NULL;

ALTER TABLE "Invoice"
ALTER COLUMN "discountIdr" SET DEFAULT 0;

ALTER TABLE "Invoice"
ALTER COLUMN "discountIdr" SET NOT NULL;
