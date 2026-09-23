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

    await this.recordQuestProgress(tx, userId, goalType, incrementBy);
  }

  /**
   * Advances the single ACTIVE seasonal quest's current step for this
   * player, if that step's goal matches. Steps clear strictly in order —
   * "current" is the first one this player hasn't completed yet — so
   * progress toward a later step never accrues early. No-ops silently if
   * there's no active quest, or the active quest's current step doesn't
   * care about this goalType.
   */
  private async recordQuestProgress(tx: Tx, userId: string, goalType: MissionGoalType, incrementBy: number): Promise<void> {
    const quest = await tx.seasonalQuest.findFirst({
      where: { status: "ACTIVE" },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!quest || quest.steps.length === 0) return;

    const userProgress = await tx.userQuestProgress.findMany({
      where: { userId, questStepId: { in: quest.steps.map((s) => s.id) } },
    });
    const progressByStepId = new Map(userProgress.map((p) => [p.questStepId, p]));

    const currentStep = quest.steps.find((s) => !progressByStepId.get(s.id)?.completedAt);
    if (!currentStep || currentStep.goalType !== goalType) return;

    const existing = progressByStepId.get(currentStep.id);
    const newProgress = Math.min((existing?.progress ?? 0) + incrementBy, currentStep.goalCount);
    const nowCompleted = !existing?.completedAt && newProgress >= currentStep.goalCount;
    await tx.userQuestProgress.upsert({
      where: { userId_questStepId: { userId, questStepId: currentStep.id } },
      update: { progress: newProgress, completedAt: nowCompleted ? new Date() : existing?.completedAt },
      create: {
        userId,
        questStepId: currentStep.id,
        progress: newProgress,
        completedAt: nowCompleted ? new Date() : null,
      },
    });
  }

  /**
   * Checks whether newly-acquired card definitions completed any series
   * (owning at least one copy of every PUBLISHED card in it) — called from
   * every place ownership of a card can change (booster, market, trade,
   * admin grant). Idempotent via UserSeriesCompletion: a series is only
   * ever counted once per player, however many times this fires for it.
   */
  async checkSeriesCompletion(tx: Tx, userId: string, cardDefinitionIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(cardDefinitionIds)];
    if (uniqueIds.length === 0) return;

    const defs = await tx.cardDefinition.findMany({
      where: { id: { in: uniqueIds } },
      select: { seriesId: true },
    });
    const seriesIds = [...new Set(defs.map((d) => d.seriesId))];

    for (const seriesId of seriesIds) {
      const already = await tx.userSeriesCompletion.findUnique({
        where: { userId_seriesId: { userId, seriesId } },
      });
      if (already) continue;

      const totalPublished = await tx.cardDefinition.count({ where: { seriesId, status: "PUBLISHED" } });
      if (totalPublished === 0) continue;

      const ownedDistinct = await tx.cardInstance.findMany({
        where: { ownerId: userId, cardDefinition: { seriesId, status: "PUBLISHED" } },
        distinct: ["cardDefinitionId"],
        select: { cardDefinitionId: true },
      });
      if (ownedDistinct.length < totalPublished) continue;

      const series = await tx.cardSeries.findUniqueOrThrow({ where: { id: seriesId } });
      await tx.userSeriesCompletion.create({ data: { userId, seriesId } });
      await this.recordProgress(tx, userId, "COMPLETE_SERIES", 1);
      await this.notifications.create(tx, userId, "SERIES_COMPLETED", { seriesId, seriesName: series.name });
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
