CREATE TYPE "AgentPortalUserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "AgentPortalAccountAuditAction" AS ENUM ('CREATED', 'ACTIVATED', 'DISABLED', 'PASSWORD_RESET', 'REVOKED');

CREATE TABLE "AgentPortalUser" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedIdentifier" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "AgentPortalUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPortalUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPortalAccountAuditLog" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT,
    "agentId" TEXT NOT NULL,
    "actorAuthUserId" TEXT,
    "action" "AgentPortalAccountAuditAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPortalAccountAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentPortalUser_normalizedIdentifier_key" ON "AgentPortalUser"("normalizedIdentifier");
CREATE INDEX "AgentPortalUser_agentId_status_idx" ON "AgentPortalUser"("agentId", "status");
CREATE INDEX "AgentPortalAccountAuditLog_portalUserId_createdAt_idx" ON "AgentPortalAccountAuditLog"("portalUserId", "createdAt");
CREATE INDEX "AgentPortalAccountAuditLog_agentId_createdAt_idx" ON "AgentPortalAccountAuditLog"("agentId", "createdAt");
CREATE INDEX "AgentPortalAccountAuditLog_actorAuthUserId_createdAt_idx" ON "AgentPortalAccountAuditLog"("actorAuthUserId", "createdAt");

ALTER TABLE "AgentPortalUser" ADD CONSTRAINT "AgentPortalUser_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentPortalAccountAuditLog" ADD CONSTRAINT "AgentPortalAccountAuditLog_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "AgentPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentPortalAccountAuditLog" ADD CONSTRAINT "AgentPortalAccountAuditLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentPortalAccountAuditLog" ADD CONSTRAINT "AgentPortalAccountAuditLog_actorAuthUserId_fkey" FOREIGN KEY ("actorAuthUserId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
