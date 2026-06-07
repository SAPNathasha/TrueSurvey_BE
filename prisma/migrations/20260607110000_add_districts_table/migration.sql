CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "provinceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "District_code_key" ON "District"("code");
CREATE UNIQUE INDEX "District_provinceId_name_key" ON "District"("provinceId", "name");
CREATE INDEX "District_provinceId_idx" ON "District"("provinceId");
CREATE INDEX "District_displayOrder_idx" ON "District"("displayOrder");
CREATE INDEX "District_isActive_idx" ON "District"("isActive");

ALTER TABLE "District"
ADD CONSTRAINT "District_provinceId_fkey"
FOREIGN KEY ("provinceId") REFERENCES "Province"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
