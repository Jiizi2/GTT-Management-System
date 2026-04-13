ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "downPaymentIdr" DECIMAL(12,2);

UPDATE "Invoice"
SET "downPaymentIdr" = 0
WHERE "downPaymentIdr" IS NULL;

ALTER TABLE "Invoice"
ALTER COLUMN "downPaymentIdr" SET DEFAULT 0;

ALTER TABLE "Invoice"
ALTER COLUMN "downPaymentIdr" SET NOT NULL;
