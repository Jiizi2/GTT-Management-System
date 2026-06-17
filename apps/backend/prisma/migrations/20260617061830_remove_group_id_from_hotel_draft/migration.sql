/*
  Warnings:

  - You are about to drop the column `assignedAt` on the `HotelAgreementDraft` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `HotelAgreementDraft` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "HotelAgreementDraft" DROP CONSTRAINT "HotelAgreementDraft_groupId_fkey";

-- DropIndex
DROP INDEX "HotelAgreementDraft_groupId_idx";

-- AlterTable
ALTER TABLE "HotelAgreementDraft" DROP COLUMN "assignedAt",
DROP COLUMN "groupId";
