-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'INACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BusStatus" AS ENUM ('VISA_ONLY', 'VISA_PLUS');

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Group" ALTER COLUMN "status" TYPE "GroupStatus" USING (
    CASE "status"
        WHEN 'Active' THEN 'ACTIVE'::"GroupStatus"
        WHEN 'In Active' THEN 'INACTIVE'::"GroupStatus"
        WHEN 'Completed' THEN 'COMPLETED'::"GroupStatus"
        WHEN 'Entry Only' THEN 'INCOMPLETE'::"GroupStatus"
        ELSE 'INCOMPLETE'::"GroupStatus"
    END
);
ALTER TABLE "Group" ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';

-- AlterTable
ALTER TABLE "VisaSetup" ADD COLUMN     "busStatus" "BusStatus";

-- CreateIndex
CREATE INDEX "Group_tone_createdAt_idx" ON "Group"("tone", "createdAt");

-- CreateIndex
CREATE INDEX "Group_parentGroupId_idx" ON "Group"("parentGroupId");
