-- Store the actual dates of the arrival and departure flights separately from
-- the group's general travel range. Nullable columns preserve existing groups.
ALTER TABLE "VisaSetup" ADD COLUMN "arrivalFlightDate" TIMESTAMP(3);
ALTER TABLE "VisaSetup" ADD COLUMN "departureFlightDate" TIMESTAMP(3);
