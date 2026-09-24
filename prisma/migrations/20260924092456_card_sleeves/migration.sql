-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "rewardSleeveId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "activeSleeveId" TEXT;

-- CreateTable
CREATE TABLE "CardSleeve" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorFrom" TEXT NOT NULL,
    "colorTo" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSleeve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCardSleeve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sleeveId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCardSleeve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardSleeve_slug_key" ON "CardSleeve"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserCardSleeve_userId_sleeveId_key" ON "UserCardSleeve"("userId", "sleeveId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_activeSleeveId_fkey" FOREIGN KEY ("activeSleeveId") REFERENCES "CardSleeve"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCardSleeve" ADD CONSTRAINT "UserCardSleeve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCardSleeve" ADD CONSTRAINT "UserCardSleeve_sleeveId_fkey" FOREIGN KEY ("sleeveId") REFERENCES "CardSleeve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_rewardSleeveId_fkey" FOREIGN KEY ("rewardSleeveId") REFERENCES "CardSleeve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
