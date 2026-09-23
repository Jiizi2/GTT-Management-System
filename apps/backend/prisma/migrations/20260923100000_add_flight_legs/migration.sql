-- Store international flights as ordered legs so direct and transit routes can
-- coexist without reusing the Saudi ground-itinerary route fields.
CREATE TYPE "FlightDirection" AS ENUM ('ONWARD', 'RETURN');

CREATE TABLE "FlightLeg" (
    "id" TEXT NOT NULL,
    "visaSetupId" TEXT NOT NULL,
    "direction" "FlightDirection" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "departureAirportCode" TEXT,
    "arrivalAirportCode" TEXT,
    "departureDate" TIMESTAMP(3),
    "departureTime" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "arrivalTime" TEXT,
    "carrierCode" TEXT,
    "flightNumber" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightLeg_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlightLeg_visaSetupId_direction_sortOrder_key"
ON "FlightLeg"("visaSetupId", "direction", "sortOrder");

CREATE INDEX "FlightLeg_visaSetupId_direction_sortOrder_idx"
ON "FlightLeg"("visaSetupId", "direction", "sortOrder");

ALTER TABLE "FlightLeg"
ADD CONSTRAINT "FlightLeg_visaSetupId_fkey"
FOREIGN KEY ("visaSetupId") REFERENCES "VisaSetup"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
