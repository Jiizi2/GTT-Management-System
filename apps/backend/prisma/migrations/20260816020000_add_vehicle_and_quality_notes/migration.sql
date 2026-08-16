-- Split the vehicle (bus plate) out of Driver into its own entity, and add
-- quality notes/flags to both Driver and the new Vehicle so ops can record a
-- dirty bus or an unimpressive driver.
ALTER TABLE "Driver" DROP COLUMN "plateNumber";
ALTER TABLE "Driver" ADD COLUMN "note" TEXT;
ALTER TABLE "Driver" ADD COLUMN "isProblematic" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "note" TEXT,
    "isProblematic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "muassasahId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Vehicle_muassasahId_idx" ON "Vehicle"("muassasahId");
CREATE INDEX "Vehicle_isActive_idx" ON "Vehicle"("isActive");
CREATE INDEX "Vehicle_plateNumber_idx" ON "Vehicle"("plateNumber");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_muassasahId_fkey" FOREIGN KEY ("muassasahId") REFERENCES "Muassasah"("id") ON DELETE SET NULL ON UPDATE CASCADE;
