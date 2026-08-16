-- Per-city hotel-agreement waiver on VisaSetup: lets ops mark that a group
-- genuinely does not need a Makkah/Madinah hotel, suppressing the "missing
-- hotel" warning and excluding it from completeness/statistics.
ALTER TABLE "VisaSetup"
  ADD COLUMN "makkahHotelWaived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "madinahHotelWaived" BOOLEAN NOT NULL DEFAULT false;
