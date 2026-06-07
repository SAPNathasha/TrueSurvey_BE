ALTER TABLE "SurveyTargetAudience"
ADD COLUMN "province" TEXT;

UPDATE "SurveyTargetAudience" sta
SET "district" = d."id"
FROM "District" d
WHERE sta."district" = d."name";

UPDATE "SurveyTargetAudience"
SET "district" = NULL
WHERE "district" IS NOT NULL
  AND "district" NOT IN (SELECT "id" FROM "District");

CREATE INDEX "SurveyTargetAudience_province_idx" ON "SurveyTargetAudience"("province");

ALTER TABLE "SurveyTargetAudience"
ADD CONSTRAINT "SurveyTargetAudience_province_fkey"
FOREIGN KEY ("province") REFERENCES "Province"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SurveyTargetAudience"
ADD CONSTRAINT "SurveyTargetAudience_district_fkey"
FOREIGN KEY ("district") REFERENCES "District"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
