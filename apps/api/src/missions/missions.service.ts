import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { MissionGoalType, Prisma } from "@railcards/database";
import { gradeForLevel as defaultGradeForLevel, levelForXp } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { GradesService } from "../grades/grades.service";
import { NotificationsService } from "../notifications/notifications.service";

type Tx = Prisma.TransactionClient;

export interface LevelUpInfo {
  leveledUp: boolean;
  newLevel: number;
  newGrade: string;
}

/**
 * Grants XP and reports whether it pushed the player into a new level.
 * `gradeForLevel` defaults to the hardcoded ladder (used by unit tests that
 * call this directly); production call sites pass GradesService's
 * DB-backed lookup instead.
 */
export async function grantXp(
  tx: Tx,
  userId: string,
  amount: number,
  gradeForLevel: (level: number) => string = defaultGradeForLevel,
): Promise<LevelUpInfo> {
  const before = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
  const levelBefore = levelForXp(before.xp);
  const after = await tx.userProfile.update({ where: { userId }, data: { xp: { increment: amount } } });
  const levelAfter = levelForXp(after.xp);
  if (levelAfter !== levelBefore) {
    await tx.userProfile.update({ where: { userId }, data: { level: levelAfter } });
  }
  return { leveledUp: levelAfter > levelBefore, newLevel: levelAfter, newGrade: gradeForLevel(levelAfter) };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly grades: GradesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Advances progress on every active mission/achievement matching
   * `goalType`. Called from within the transaction of the action that
   * caused the progress (booster opened, trade completed, ...), so
   * progress tracking is atomic with the action itself.
   */
  async recordProgress(tx: Tx, userId: string, goalType: MissionGoalType, incrementBy = 1): Promise<void> {
    const missions = await tx.mission.findMany({ where: { goalType, isActive: true } });
    for (const mission of missions) {
      const periodKey = mission.resetPeriod === "DAILY" ? todayKey() : "PERMANENT";
      const existing = await tx.userMission.findUnique({
        where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey } },
      });
      const newProgress = Math.min((existing?.progress ?? 0) + incrementBy, mission.goalCount);
      const nowCompleted = !existing?.completedAt && newProgress >= mission.goalCount;
      await tx.userMission.upsert({
        where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey } },
        update: { progress: newProgress, completedAt: nowCompleted ? new Date() : existing?.completedAt },
        create: {
          userId,
          missionId: mission.id,
          periodKey,
          progress: newProgress,
          completedAt: nowCompleted ? new Date() : null,
        },
      });
    }

    const achievements = await tx.achievement.findMany({ where: { goalType, isActive: true } });
    for (const achievement of achievements) {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });
      const newProgress = Math.min((existing?.progress ?? 0) + incrementBy, achievement.goalCount);
      const nowCompleted = !existing?.completedAt && newProgress >= achievement.goalCount;
      await tx.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        update: { progress: newProgress, completedAt: nowCompleted ? new Date() : existing?.completedAt },
        create: {
          userId,
          achievementId: achievement.id,
          progress: newProgress,
          completedAt: nowCompleted ? new Date() : null,
        },
      });
    }
  }

  async listMissions(userId: string) {
    const missions = await this.prisma.mission.findMany({ where: { isActive: true } });
    const periodKeys = [...new Set(missions.map((m) => (m.resetPeriod === "DAILY" ? todayKey() : "PERMANENT")))];
    const userMissions = await this.prisma.userMission.findMany({
      where: { userId, missionId: { in: missions.map((m) => m.id) }, periodKey: { in: periodKeys } },
    });
    const byMissionId = new Map(userMissions.map((um) => [um.missionId, um]));

    return missions.map((mission) => {
      const periodKey = mission.resetPeriod === "DAILY" ? todayKey() : "PERMANENT";
      const um = byMissionId.get(mission.id);
      return {
        mission,
        userMissionId: um?.id ?? null,
        progress: um?.progress ?? 0,
        completedAt: um?.completedAt ?? null,
        claimedAt: um?.claimedAt ?? null,
        periodKey,
      };
    });
  }

  async listAchievements(userId: string) {
    const achievements = await this.prisma.achievement.findMany({ where: { isActive: true } });
    const userAchievements = await this.prisma.userAchievement.findMany({ where: { userId } });
    const byId = new Map(userAchievements.map((ua) => [ua.achievementId, ua]));
    return achievements.map((achievement) => {
      const ua = byId.get(achievement.id);
      return {
        achievement,
        progress: ua?.progress ?? 0,
        completedAt: ua?.completedAt ?? null,
        claimedAt: ua?.claimedAt ?? null,
      };
    });
  }

  async claimMission(userId: string, userMissionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const um = await tx.userMission.findUnique({ where: { id: userMissionId }, include: { mission: true } });
      if (!um || um.userId !== userId) throw new NotFoundException("Mission progress not found");
      if (!um.completedAt) throw new BadRequestException("Mission is not completed yet");
      if (um.claimedAt) throw new BadRequestException("Mission reward already claimed");

      if (um.mission.rewardCr > 0) {
        await this.wallet.credit(tx, {
          userId,
          amount: um.mission.rewardCr,
          type: "MISSION_REWARD",
          referenceType: "UserMission",
          referenceId: um.id,
          idempotencyKey: `mission-claim-${um.id}`,
        });
      }
      const levelUp: LevelUpInfo =
        um.mission.rewardXp > 0
          ? await grantXp(tx, userId, um.mission.rewardXp, (l) => this.grades.gradeForLevel(l))
          : { leveledUp: false, newLevel: 0, newGrade: "" };

      const userMission = await tx.userMission.update({ where: { id: um.id }, data: { claimedAt: new Date() } });

      await this.notifications.create(tx, userId, "MISSION_COMPLETED", {
        missionId: um.mission.id,
        title: um.mission.title,
        rewardCr: um.mission.rewardCr,
        rewardXp: um.mission.rewardXp,
      });
      if (levelUp.leveledUp) {
        await this.notifications.create(tx, userId, "LEVEL_UP", { newLevel: levelUp.newLevel, newGrade: levelUp.newGrade });
      }

      return { ...userMission, ...levelUp };
    });
  }

  async claimAchievement(userId: string, achievementId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ua = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId } },
        include: { achievement: true },
      });
      if (!ua) throw new NotFoundException("Achievement progress not found");
      if (!ua.completedAt) throw new BadRequestException("Achievement is not completed yet");
      if (ua.claimedAt) throw new BadRequestException("Achievement reward already claimed");

      if (ua.achievement.rewardCr > 0) {
        await this.wallet.credit(tx, {
          userId,
          amount: ua.achievement.rewardCr,
          type: "ACHIEVEMENT_REWARD",
          referenceType: "UserAchievement",
          referenceId: ua.id,
          idempotencyKey: `achievement-claim-${ua.id}`,
        });
      }
      const levelUp: LevelUpInfo =
        ua.achievement.rewardXp > 0
          ? await grantXp(tx, userId, ua.achievement.rewardXp, (l) => this.grades.gradeForLevel(l))
          : { leveledUp: false, newLevel: 0, newGrade: "" };

      const userAchievement = await tx.userAchievement.update({ where: { id: ua.id }, data: { claimedAt: new Date() } });

      await this.notifications.create(tx, userId, "ACHIEVEMENT_UNLOCKED", {
        achievementId: ua.achievement.id,
        title: ua.achievement.title,
        rewardCr: ua.achievement.rewardCr,
        rewardXp: ua.achievement.rewardXp,
      });
      if (levelUp.leveledUp) {
        await this.notifications.create(tx, userId, "LEVEL_UP", { newLevel: levelUp.newLevel, newGrade: levelUp.newGrade });
      }

      return { ...userAchievement, ...levelUp };
    });
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listAllMissionsForAdmin() {
    return this.prisma.mission.findMany({ orderBy: { createdAt: "asc" } });
  }

  async createMission(data: Parameters<PrismaService["mission"]["create"]>[0]["data"]) {
    return this.prisma.mission.create({ data });
  }

  async updateMission(id: string, data: Parameters<PrismaService["mission"]["update"]>[0]["data"]) {
    return this.prisma.mission.update({ where: { id }, data });
  }

  async listAllAchievementsForAdmin() {
    return this.prisma.achievement.findMany({ orderBy: { createdAt: "asc" } });
  }

  async createAchievement(data: Parameters<PrismaService["achievement"]["create"]>[0]["data"]) {
    return this.prisma.achievement.create({ data });
  }

  async updateAchievement(id: string, data: Parameters<PrismaService["achievement"]["update"]>[0]["data"]) {
    return this.prisma.achievement.update({ where: { id }, data });
  }
}
