-- CreateEnum
CREATE TYPE "VisaBusStatus" AS ENUM ('VISA_ONLY', 'VISA_PLUS');

-- AlterTable
ALTER TABLE "VisaSetup" ADD COLUMN "busStatus" "VisaBusStatus";

-- Backfill from legacy note markers while keeping the notes intact for compatibility.
UPDATE "VisaSetup" AS vs
SET "busStatus" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "GroupNote" AS gn
    WHERE gn."groupId" = vs."groupId"
      AND lower(gn."text") LIKE 'bus status:%visa+%'
  ) OR EXISTS (
    SELECT 1
    FROM "GroupNote" AS gn
    WHERE gn."groupId" = vs."groupId"
      AND lower(gn."text") ~ 'bus status:.*bus[[:space:]]*(internal|luar)'
  ) THEN 'VISA_PLUS'::"VisaBusStatus"
  WHEN EXISTS (
    SELECT 1
    FROM "GroupNote" AS gn
    WHERE gn."groupId" = vs."groupId"
      AND lower(gn."text") LIKE 'bus status:%visa only%'
  ) THEN 'VISA_ONLY'::"VisaBusStatus"
  ELSE vs."busStatus"
END;
