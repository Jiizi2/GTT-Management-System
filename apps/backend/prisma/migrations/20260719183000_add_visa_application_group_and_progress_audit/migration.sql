ALTER TABLE "VisaApplication" ADD COLUMN "groupId" TEXT;

CREATE TABLE "VisaApplicationProgressAuditLog" (
  "id" TEXT NOT NULL,
  "visaApplicationId" TEXT NOT NULL,
  "actorAuthUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisaApplicationProgressAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisaApplication_groupId_key" ON "VisaApplication"("groupId");
CREATE INDEX "VisaApplicationProgressAuditLog_visaApplicationId_createdAt_idx"
  ON "VisaApplicationProgressAuditLog"("visaApplicationId", "createdAt" DESC);
CREATE INDEX "VisaApplicationProgressAuditLog_actorAuthUserId_createdAt_idx"
  ON "VisaApplicationProgressAuditLog"("actorAuthUserId", "createdAt" DESC);

ALTER TABLE "VisaApplication"
  ADD CONSTRAINT "VisaApplication_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisaApplicationProgressAuditLog"
  ADD CONSTRAINT "VisaApplicationProgressAuditLog_visaApplicationId_fkey"
  FOREIGN KEY ("visaApplicationId") REFERENCES "VisaApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisaApplicationProgressAuditLog"
  ADD CONSTRAINT "VisaApplicationProgressAuditLog_actorAuthUserId_fkey"
  FOREIGN KEY ("actorAuthUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
