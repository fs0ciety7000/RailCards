-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "rewardTitleId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "activeTitleId" TEXT;

-- CreateTable
CREATE TABLE "ProfileTitle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileTitle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfileTitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileTitle_slug_key" ON "ProfileTitle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileTitle_userId_titleId_key" ON "UserProfileTitle"("userId", "titleId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_activeTitleId_fkey" FOREIGN KEY ("activeTitleId") REFERENCES "ProfileTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileTitle" ADD CONSTRAINT "UserProfileTitle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileTitle" ADD CONSTRAINT "UserProfileTitle_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "ProfileTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_rewardTitleId_fkey" FOREIGN KEY ("rewardTitleId") REFERENCES "ProfileTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
