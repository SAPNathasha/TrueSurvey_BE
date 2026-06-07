-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "districtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_code_key" ON "City"("code");

-- CreateIndex
CREATE INDEX "City_districtId_idx" ON "City"("districtId");

-- CreateIndex
CREATE INDEX "City_displayOrder_idx" ON "City"("displayOrder");

-- CreateIndex
CREATE INDEX "City_isActive_idx" ON "City"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "City_districtId_name_key" ON "City"("districtId", "name");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "SurveyTargetAudience" sta
SET "city" = c."id"
FROM "City" c
WHERE sta."city" = c."name";

UPDATE "SurveyTargetAudience"
SET "city" = NULL
WHERE "city" IS NOT NULL
  AND "city" NOT IN (SELECT "id" FROM "City");

ALTER TABLE "SurveyTargetAudience"
ADD CONSTRAINT "SurveyTargetAudience_city_fkey"
FOREIGN KEY ("city") REFERENCES "City"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
