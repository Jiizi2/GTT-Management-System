-- Add required group travel period fields while preserving existing rows.
ALTER TABLE "Group"
ADD COLUMN "arrivalDate" TIMESTAMP(3),
ADD COLUMN "returnDate" TIMESTAMP(3);

UPDATE "Group" AS g
SET
  "arrivalDate" = COALESCE(
    (
      SELECT MIN(i."isoDate")
      FROM "ItineraryItem" AS i
      WHERE i."groupId" = g."id" AND i."isoDate" IS NOT NULL
    ),
    g."createdAt"
  ),
  "returnDate" = COALESCE(
    (
      SELECT MAX(i."isoDate")
      FROM "ItineraryItem" AS i
      WHERE i."groupId" = g."id" AND i."isoDate" IS NOT NULL
    ),
    g."createdAt"
  );

UPDATE "Group"
SET "returnDate" = "arrivalDate"
WHERE "returnDate" < "arrivalDate";

ALTER TABLE "Group"
ALTER COLUMN "arrivalDate" SET NOT NULL,
ALTER COLUMN "returnDate" SET NOT NULL;
