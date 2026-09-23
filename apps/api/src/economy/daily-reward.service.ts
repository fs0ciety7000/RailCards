import { BadRequestException, Injectable } from "@nestjs/common";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "./wallet.service";
import { GradesService } from "../grades/grades.service";
import { NotificationsService } from "../notifications/notifications.service";
import { grantXp, type LevelUpInfo } from "../missions/missions.service";

function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class DailyRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly grades: GradesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 1x on day one, +20% per consecutive day after that, capped at the streak cap. */
  static multiplierForStreak(streak: number): number {
    return 1 + (streak - 1) * GAME_CONSTANTS.DAILY_REWARD_STREAK_MULTIPLIER_STEP;
  }

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
      const multiplier = DailyRewardService.multiplierForStreak(streak);
      const rewardCr = Math.round(GAME_CONSTANTS.DAILY_REWARD_BASE_CR * multiplier);
      const rewardXp = Math.round(GAME_CONSTANTS.DAILY_REWARD_BASE_XP * multiplier);

      await tx.dailyRewardClaim.create({
        data: { userId, claimDate: today, streakCount: streak, rewardCr, rewardXp },
      });

      const transaction = await this.wallet.credit(tx, {
        userId,
        amount: rewardCr,
        type: "DAILY_REWARD",
        referenceType: "DailyRewardClaim",
        referenceId: today.toISOString(),
        idempotencyKey: `daily-reward-${userId}-${today.toISOString().slice(0, 10)}`,
      });

      const levelUp: LevelUpInfo = await grantXp(tx, userId, rewardXp, (l) => this.grades.gradeForLevel(l));

      await tx.userProfile.update({
        where: { userId },
        data: { dailyRewardStreak: streak, lastDailyRewardAt: new Date() },
      });

      if (levelUp.leveledUp) {
        await this.notifications.create(tx, userId, "LEVEL_UP", { newLevel: levelUp.newLevel, newGrade: levelUp.newGrade });
      }

      return { rewardCr, rewardXp, streak, multiplier, balanceAfter: transaction.balanceAfter, ...levelUp };
    });
  }

  async status(userId: string) {
    const today = todayUtcDateOnly();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const [claim, yesterdayClaim, profile] = await Promise.all([
      this.prisma.dailyRewardClaim.findUnique({ where: { userId_claimDate: { userId, claimDate: today } } }),
      this.prisma.dailyRewardClaim.findUnique({ where: { userId_claimDate: { userId, claimDate: yesterday } } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
    ]);
    const currentStreak = profile?.dailyRewardStreak ?? 0;
    // The streak claiming right now would produce: continues yesterday's
    // run (+1, capped) if it's still alive, or restarts at 1 if it lapsed —
    // shown so the player sees the multiplier they're about to earn.
    const nextStreak = claim ? currentStreak : Math.min((yesterdayClaim?.streakCount ?? 0) + 1, GAME_CONSTANTS.DAILY_REWARD_STREAK_CAP_DAYS);
    return {
      claimedToday: Boolean(claim),
      currentStreak,
      nextMultiplier: DailyRewardService.multiplierForStreak(nextStreak),
    };
  }
}
