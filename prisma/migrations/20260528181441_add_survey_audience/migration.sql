/*
  Warnings:

  - Added the required column `category` to the `Survey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `estimatedCompletionDays` to the `Survey` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `Survey` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SurveyCategory" AS ENUM ('CUSTOMER_FEEDBACK', 'MARKET_RESEARCH', 'EMPLOYEE_ENGAGEMENT', 'EDUCATION', 'HEALTHCARE', 'PRODUCT_RESEARCH', 'EVENT_FEEDBACK', 'OTHER');

-- CreateEnum
CREATE TYPE "SurveyCreationStep" AS ENUM ('BASIC_DETAILS', 'SELECT_METHOD', 'CREATE_QUESTIONS', 'TARGET_AUDIENCE', 'SAMPLE_BUDGET', 'PREVIEW_SUBMIT', 'COMPLETED');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "category" "SurveyCategory" NOT NULL,
ADD COLUMN     "currentStep" "SurveyCreationStep" NOT NULL DEFAULT 'BASIC_DETAILS',
ADD COLUMN     "estimatedCompletionDays" INTEGER NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Survey_category_idx" ON "Survey"("category");
