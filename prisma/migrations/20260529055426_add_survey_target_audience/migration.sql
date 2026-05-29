-- CreateEnum
CREATE TYPE "AudienceGender" AS ENUM ('ALL', 'MALE', 'FEMALE', 'OTHER');

-- CreateTable
CREATE TABLE "SurveyTargetAudience" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "minimumAge" INTEGER,
    "maximumAge" INTEGER,
    "gender" "AudienceGender" NOT NULL DEFAULT 'ALL',
    "city" TEXT,
    "district" TEXT,
    "educationLevel" TEXT,
    "occupation" TEXT,
    "sampleBase" "SurveyAudienceType" NOT NULL DEFAULT 'GENERAL',
    "estimatedReach" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyTargetAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyTargetAudience_surveyId_key" ON "SurveyTargetAudience"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyTargetAudience_sampleBase_idx" ON "SurveyTargetAudience"("sampleBase");

-- CreateIndex
CREATE INDEX "SurveyTargetAudience_city_idx" ON "SurveyTargetAudience"("city");

-- CreateIndex
CREATE INDEX "SurveyTargetAudience_district_idx" ON "SurveyTargetAudience"("district");

-- AddForeignKey
ALTER TABLE "SurveyTargetAudience" ADD CONSTRAINT "SurveyTargetAudience_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
