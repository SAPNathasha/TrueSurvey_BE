CREATE TYPE "IdVerificationStatus" AS ENUM (
  'NOT_TRIED',
  'PENDING',
  'ACCEPTED',
  'REJECTED'
);

ALTER TABLE "User"
ADD COLUMN "idVerificationStatus" "IdVerificationStatus" NOT NULL DEFAULT 'NOT_TRIED';
