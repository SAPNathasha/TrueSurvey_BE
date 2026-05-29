-- CreateEnum
CREATE TYPE "SurveyCreationMethod" AS ENUM ('AI_ASSISTED', 'MANUAL');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "creationMethod" "SurveyCreationMethod";
