CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Province_name_key" ON "Province"("name");
CREATE UNIQUE INDEX "Province_code_key" ON "Province"("code");
CREATE INDEX "Province_displayOrder_idx" ON "Province"("displayOrder");
CREATE INDEX "Province_isActive_idx" ON "Province"("isActive");
