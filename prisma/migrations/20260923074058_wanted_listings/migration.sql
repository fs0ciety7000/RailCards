-- CreateEnum
CREATE TYPE "WantedListingStatus" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WantedListing" (
    "id" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "cardDefinitionId" TEXT NOT NULL,
    "note" TEXT,
    "status" "WantedListingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WantedListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WantedListing_posterId_idx" ON "WantedListing"("posterId");

-- CreateIndex
CREATE INDEX "WantedListing_status_idx" ON "WantedListing"("status");

-- CreateIndex
CREATE INDEX "WantedListing_cardDefinitionId_idx" ON "WantedListing"("cardDefinitionId");

-- AddForeignKey
ALTER TABLE "WantedListing" ADD CONSTRAINT "WantedListing_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WantedListing" ADD CONSTRAINT "WantedListing_cardDefinitionId_fkey" FOREIGN KEY ("cardDefinitionId") REFERENCES "CardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
