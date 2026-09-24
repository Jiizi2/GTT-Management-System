ALTER TABLE "ItineraryItem"
ADD COLUMN "busCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "ItineraryItem"
SET "busCount" = 1
WHERE "requiresBus" = true;
