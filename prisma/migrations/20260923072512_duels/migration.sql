-- CreateEnum
CREATE TYPE "DuelStat" AS ENUM ('POWER', 'RELIABILITY', 'CHARM');

-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DUEL_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'DUEL_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'DUEL_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'DUEL_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'DUEL_EXPIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTransactionType" ADD VALUE 'DUEL_WAGER';
ALTER TYPE "WalletTransactionType" ADD VALUE 'DUEL_PAYOUT';

-- CreateTable
CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "challengerCardInstanceId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "opponentCardInstanceId" TEXT,
    "wagerCr" INTEGER NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'PENDING',
    "stat" "DuelStat",
    "challengerValue" INTEGER,
    "opponentValue" INTEGER,
    "winnerId" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Duel_challengerId_idx" ON "Duel"("challengerId");

-- CreateIndex
CREATE INDEX "Duel_opponentId_idx" ON "Duel"("opponentId");

-- CreateIndex
CREATE INDEX "Duel_status_idx" ON "Duel"("status");

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerCardInstanceId_fkey" FOREIGN KEY ("challengerCardInstanceId") REFERENCES "CardInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentCardInstanceId_fkey" FOREIGN KEY ("opponentCardInstanceId") REFERENCES "CardInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
