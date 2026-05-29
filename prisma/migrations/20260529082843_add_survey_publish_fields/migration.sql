-- CreateEnum
CREATE TYPE "SurveyPublishOption" AS ENUM ('PUBLISH_NOW', 'SCHEDULE', 'SAVE_DRAFT');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3);
