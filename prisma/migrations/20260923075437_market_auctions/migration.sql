-- CreateEnum
CREATE TYPE "MarketListingType" AS ENUM ('FIXED', 'AUCTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'AUCTION_OUTBID';
ALTER TYPE "NotificationType" ADD VALUE 'AUCTION_NEW_BID';
ALTER TYPE "NotificationType" ADD VALUE 'AUCTION_WON';
ALTER TYPE "NotificationType" ADD VALUE 'AUCTION_ENDED_NO_BIDS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTransactionType" ADD VALUE 'AUCTION_BID_HOLD';
ALTER TYPE "WalletTransactionType" ADD VALUE 'AUCTION_BID_REFUND';

-- AlterTable
ALTER TABLE "MarketListing" ADD COLUMN     "auctionEndsAt" TIMESTAMP(3),
ADD COLUMN     "currentBidCr" INTEGER,
ADD COLUMN     "currentBidderId" TEXT,
ADD COLUMN     "listingType" "MarketListingType" NOT NULL DEFAULT 'FIXED';

-- CreateTable
CREATE TABLE "MarketBid" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amountCr" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketBid_listingId_idx" ON "MarketBid"("listingId");

-- CreateIndex
CREATE INDEX "MarketBid_bidderId_idx" ON "MarketBid"("bidderId");

-- CreateIndex
CREATE INDEX "MarketListing_currentBidderId_idx" ON "MarketListing"("currentBidderId");

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_currentBidderId_fkey" FOREIGN KEY ("currentBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketBid" ADD CONSTRAINT "MarketBid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketBid" ADD CONSTRAINT "MarketBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
