-- CreateEnum
CREATE TYPE "SurveyBudgetCurrency" AS ENUM ('LKR', 'USD');

-- CreateEnum
CREATE TYPE "RewardDistributionType" AS ENUM ('EQUAL_PER_PARTICIPANT');

-- CreateTable
CREATE TABLE "SurveySampleBudget" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "requiredResponses" INTEGER NOT NULL,
    "totalBudget" DECIMAL(12,2) NOT NULL,
    "platformCommissionPercentage" DECIMAL(5,2) NOT NULL,
    "platformCommissionAmount" DECIMAL(12,2) NOT NULL,
    "participantRewardBudget" DECIMAL(12,2) NOT NULL,
    "rewardPerParticipant" DECIMAL(12,2) NOT NULL,
    "rewardDistribution" "RewardDistributionType" NOT NULL DEFAULT 'EQUAL_PER_PARTICIPANT',
    "currency" "SurveyBudgetCurrency" NOT NULL DEFAULT 'LKR',
    "budgetNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveySampleBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveySampleBudget_surveyId_key" ON "SurveySampleBudget"("surveyId");

-- AddForeignKey
ALTER TABLE "SurveySampleBudget" ADD CONSTRAINT "SurveySampleBudget_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
