-- CreateTable
CREATE TABLE "FavoriteCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardDefinitionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteCard_userId_idx" ON "FavoriteCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteCard_userId_cardDefinitionId_key" ON "FavoriteCard"("userId", "cardDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteCard_userId_position_key" ON "FavoriteCard"("userId", "position");

-- AddForeignKey
ALTER TABLE "FavoriteCard" ADD CONSTRAINT "FavoriteCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCard" ADD CONSTRAINT "FavoriteCard_cardDefinitionId_fkey" FOREIGN KEY ("cardDefinitionId") REFERENCES "CardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
