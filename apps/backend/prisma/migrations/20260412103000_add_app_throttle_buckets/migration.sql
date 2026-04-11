CREATE TABLE "AppThrottleBucket" (
  "key" TEXT NOT NULL,
  "hitEpochMs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "blockedUntil" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppThrottleBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AppThrottleBucket_lastSeenAt_idx" ON "AppThrottleBucket"("lastSeenAt");
CREATE INDEX "AppThrottleBucket_blockedUntil_idx" ON "AppThrottleBucket"("blockedUntil");
