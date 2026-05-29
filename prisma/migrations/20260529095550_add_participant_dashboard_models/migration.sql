/*
  Warnings:

  - A unique constraint covering the columns `[surveyId,participantId]` on the table `SurveyResponse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `SurveyResponse` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SurveyResponseStatus" AS ENUM ('STARTED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'RELEASED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('SURVEY_REWARD', 'WITHDRAWAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "rewardAmount" DECIMAL(12,2),
ADD COLUMN     "rewardStatus" "RewardStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "SurveyResponseStatus" NOT NULL DEFAULT 'STARTED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "participantAge" INTEGER,
ADD COLUMN     "participantCity" TEXT,
ADD COLUMN     "participantDistrict" TEXT,
ADD COLUMN     "participantEducationLevel" TEXT,
ADD COLUMN     "participantGender" "AudienceGender",
ADD COLUMN     "participantOccupation" TEXT;

-- CreateTable
CREATE TABLE "ParticipantWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pendingRewards" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalWithdrawn" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" "SurveyBudgetCurrency" NOT NULL DEFAULT 'LKR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surveyResponseId" TEXT,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "SurveyBudgetCurrency" NOT NULL DEFAULT 'LKR',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantWallet_userId_key" ON "ParticipantWallet"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- CreateIndex
CREATE INDEX "SurveyResponse_status_idx" ON "SurveyResponse"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_participantId_key" ON "SurveyResponse"("surveyId", "participantId");

-- AddForeignKey
ALTER TABLE "ParticipantWallet" ADD CONSTRAINT "ParticipantWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
