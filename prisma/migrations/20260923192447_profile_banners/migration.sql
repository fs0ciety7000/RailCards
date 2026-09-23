-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "rewardBannerId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "activeBannerId" TEXT;

-- CreateTable
CREATE TABLE "ProfileBanner" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorFrom" TEXT NOT NULL,
    "colorTo" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileBanner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfileBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileBanner_slug_key" ON "ProfileBanner"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileBanner_userId_bannerId_key" ON "UserProfileBanner"("userId", "bannerId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_activeBannerId_fkey" FOREIGN KEY ("activeBannerId") REFERENCES "ProfileBanner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileBanner" ADD CONSTRAINT "UserProfileBanner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileBanner" ADD CONSTRAINT "UserProfileBanner_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "ProfileBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_rewardBannerId_fkey" FOREIGN KEY ("rewardBannerId") REFERENCES "ProfileBanner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
