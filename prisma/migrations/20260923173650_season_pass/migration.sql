-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SEASON_PASS_REWARD';

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'SEASON_PASS_REWARD';

-- CreateTable
CREATE TABLE "SeasonPassTier" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "pointsRequired" INTEGER NOT NULL,
    "rewardCr" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "rewardLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonPassTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonPassClaim" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonPassClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeasonPassTier_seasonId_idx" ON "SeasonPassTier"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPassTier_seasonId_tier_key" ON "SeasonPassTier"("seasonId", "tier");

-- CreateIndex
CREATE INDEX "SeasonPassClaim_userId_idx" ON "SeasonPassClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPassClaim_tierId_userId_key" ON "SeasonPassClaim"("tierId", "userId");

-- AddForeignKey
ALTER TABLE "SeasonPassTier" ADD CONSTRAINT "SeasonPassTier_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPassClaim" ADD CONSTRAINT "SeasonPassClaim_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SeasonPassTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPassClaim" ADD CONSTRAINT "SeasonPassClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
