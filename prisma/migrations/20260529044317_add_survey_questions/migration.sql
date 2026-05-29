-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'SINGLE_SELECT', 'RATING_SCALE', 'SHORT_ANSWER', 'LONG_ANSWER', 'YES_NO');

-- CreateEnum
CREATE TYPE "SurveyQuestionSource" AS ENUM ('AI_GENERATED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AiAnswerStyle" AS ENUM ('MULTIPLE_CHOICE', 'SINGLE_SELECT', 'RATING_SCALE', 'MIXED');

-- CreateEnum
CREATE TYPE "AiToneStyle" AS ENUM ('PROFESSIONAL_FRIENDLY', 'SIMPLE_CLEAR', 'ACADEMIC', 'CASUAL');

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "type" "SurveyQuestionType" NOT NULL,
    "source" "SurveyQuestionSource" NOT NULL DEFAULT 'AI_GENERATED',
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_idx" ON "SurveyQuestion"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyQuestion_type_idx" ON "SurveyQuestion"("type");

-- CreateIndex
CREATE INDEX "SurveyQuestionOption_questionId_idx" ON "SurveyQuestionOption"("questionId");

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestionOption" ADD CONSTRAINT "SurveyQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
