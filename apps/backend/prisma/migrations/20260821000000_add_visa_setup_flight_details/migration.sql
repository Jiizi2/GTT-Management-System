-- Store the arrival/departure flight details directly on VisaSetup so a MOFA
-- visa can be prepared from Visa Detail without first building a full itinerary.
-- All nullable so existing VisaSetup rows keep working.
ALTER TABLE "VisaSetup" ADD COLUMN "arrivalFlightNumber" TEXT;
ALTER TABLE "VisaSetup" ADD COLUMN "arrivalTime" TEXT;
ALTER TABLE "VisaSetup" ADD COLUMN "departureFlightNumber" TEXT;
ALTER TABLE "VisaSetup" ADD COLUMN "departureTime" TEXT;
