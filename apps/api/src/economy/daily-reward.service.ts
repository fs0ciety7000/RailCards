import { BadRequestException, Injectable } from "@nestjs/common";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "./wallet.service";

function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class DailyRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async claim(userId: string) {
    const today = todayUtcDateOnly();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    return this.prisma.$transaction(async (tx) => {
      const alreadyClaimed = await tx.dailyRewardClaim.findUnique({
        where: { userId_claimDate: { userId, claimDate: today } },
      });
      if (alreadyClaimed) {
        throw new BadRequestException("Daily reward already claimed today");
      }

      const yesterdayClaim = await tx.dailyRewardClaim.findUnique({
        where: { userId_claimDate: { userId, claimDate: yesterday } },
      });
      const streak = Math.min(
        (yesterdayClaim?.streakCount ?? 0) + 1,
        GAME_CONSTANTS.DAILY_REWARD_STREAK_CAP_DAYS,
      );
      const rewardCr =
        GAME_CONSTANTS.DAILY_REWARD_BASE_CR + (streak - 1) * GAME_CONSTANTS.DAILY_REWARD_STREAK_BONUS_CR;

      await tx.dailyRewardClaim.create({
        data: { userId, claimDate: today, streakCount: streak, rewardCr },
      });

      const transaction = await this.wallet.credit(tx, {
        userId,
        amount: rewardCr,
        type: "DAILY_REWARD",
        referenceType: "DailyRewardClaim",
        referenceId: today.toISOString(),
        idempotencyKey: `daily-reward-${userId}-${today.toISOString().slice(0, 10)}`,
      });

      await tx.userProfile.update({
        where: { userId },
        data: { dailyRewardStreak: streak, lastDailyRewardAt: new Date() },
      });

      return { rewardCr, streak, balanceAfter: transaction.balanceAfter };
    });
  }

  async status(userId: string) {
    const today = todayUtcDateOnly();
    const claim = await this.prisma.dailyRewardClaim.findUnique({
      where: { userId_claimDate: { userId, claimDate: today } },
    });
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    return {
      claimedToday: Boolean(claim),
      currentStreak: profile?.dailyRewardStreak ?? 0,
    };
  }
}
