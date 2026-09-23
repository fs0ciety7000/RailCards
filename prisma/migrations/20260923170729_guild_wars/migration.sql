-- CreateEnum
CREATE TYPE "GuildWarStatus" AS ENUM ('ACTIVE', 'ENDED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'GUILD_WAR_REWARD';

-- CreateTable
CREATE TABLE "GuildWarPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GuildWarStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GuildWarPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildWarPoint" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuildWarPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildWarPoint_periodId_idx" ON "GuildWarPoint"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildWarPoint_periodId_guildId_key" ON "GuildWarPoint"("periodId", "guildId");

-- AddForeignKey
ALTER TABLE "GuildWarPoint" ADD CONSTRAINT "GuildWarPoint_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "GuildWarPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildWarPoint" ADD CONSTRAINT "GuildWarPoint_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
