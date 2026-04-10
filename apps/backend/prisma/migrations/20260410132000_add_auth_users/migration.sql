-- CreateEnum
CREATE TYPE "AuthUserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'CUSTOMER_SUPPORT');

-- CreateTable
CREATE TABLE "AuthUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "AuthUserRole" NOT NULL DEFAULT 'ADMIN',
  "passwordHash" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_username_key" ON "AuthUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_email_key" ON "AuthUser"("email");

-- CreateIndex
CREATE INDEX "AuthUser_role_idx" ON "AuthUser"("role");

-- CreateIndex
CREATE INDEX "AuthUser_isActive_idx" ON "AuthUser"("isActive");
