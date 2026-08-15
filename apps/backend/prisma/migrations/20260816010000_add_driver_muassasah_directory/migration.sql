-- Driver directory tied to Muassasah (managed reference data surfaced in Master
-- Data and populated from the H-1 checklist driver input).
CREATE TABLE "Muassasah" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Muassasah_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "plateNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "muassasahId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Muassasah_name_key" ON "Muassasah"("name");
CREATE INDEX "Muassasah_isActive_idx" ON "Muassasah"("isActive");
CREATE INDEX "Driver_muassasahId_idx" ON "Driver"("muassasahId");
CREATE INDEX "Driver_isActive_idx" ON "Driver"("isActive");
CREATE INDEX "Driver_name_idx" ON "Driver"("name");

ALTER TABLE "Driver" ADD CONSTRAINT "Driver_muassasahId_fkey" FOREIGN KEY ("muassasahId") REFERENCES "Muassasah"("id") ON DELETE SET NULL ON UPDATE CASCADE;
