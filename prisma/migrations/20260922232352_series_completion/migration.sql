-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SERIES_COMPLETED';

-- CreateTable
CREATE TABLE "UserSeriesCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSeriesCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSeriesCompletion_userId_seriesId_key" ON "UserSeriesCompletion"("userId", "seriesId");

-- AddForeignKey
ALTER TABLE "UserSeriesCompletion" ADD CONSTRAINT "UserSeriesCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSeriesCompletion" ADD CONSTRAINT "UserSeriesCompletion_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "CardSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
