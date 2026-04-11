CREATE TABLE "AuthLoginRateLimitBucket" (
  "key" TEXT NOT NULL,
  "failedAttemptEpochMs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lockedUntil" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthLoginRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "GroupAuditLog" (
  "id" TEXT NOT NULL,
  "groupId" TEXT,
  "groupCode" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GroupAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthLoginRateLimitBucket_lastSeenAt_idx" ON "AuthLoginRateLimitBucket"("lastSeenAt");
CREATE INDEX "AuthLoginRateLimitBucket_lockedUntil_idx" ON "AuthLoginRateLimitBucket"("lockedUntil");
CREATE INDEX "GroupAuditLog_groupId_createdAt_idx" ON "GroupAuditLog"("groupId", "createdAt");
CREATE INDEX "GroupAuditLog_groupCode_createdAt_idx" ON "GroupAuditLog"("groupCode", "createdAt");
CREATE INDEX "GroupAuditLog_createdAt_idx" ON "GroupAuditLog"("createdAt");

ALTER TABLE "GroupAuditLog"
ADD CONSTRAINT "GroupAuditLog_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
