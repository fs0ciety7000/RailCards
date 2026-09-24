-- AlterEnum
ALTER TYPE "AcquisitionSource" ADD VALUE 'SIGNATURE_EVENT';

-- AlterTable
ALTER TABLE "CardInstance" ADD COLUMN     "isSignature" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signatureEdition" INTEGER,
ADD COLUMN     "signatureNumber" INTEGER;
