/*
  Warnings:

  - You are about to drop the column `fullName` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nicHash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "fullName",
ADD COLUMN     "nicHash" TEXT,
ADD COLUMN     "nicImagePath" TEXT,
ADD COLUMN     "selfiePath" TEXT,
ADD COLUMN     "username" TEXT NOT NULL DEFAULT 'existing_user';

-- CreateIndex
CREATE UNIQUE INDEX "User_nicHash_key" ON "User"("nicHash");
