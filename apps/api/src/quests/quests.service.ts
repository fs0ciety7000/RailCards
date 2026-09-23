import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { GradesService } from "../grades/grades.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EventsService } from "../events/events.service";
import { SeasonsService } from "../seasons/seasons.service";
import { GuildWarsService } from "../guild-wars/guild-wars.service";
import { grantXp, type LevelUpInfo } from "../missions/missions.service";

type Tx = Prisma.TransactionClient;

@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly grades: GradesService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
    private readonly seasons: SeasonsService,
    private readonly guildWars: GuildWarsService,
  ) {}

  /** Same event-multiplier + season-points + guild-war bonus as MissionsService.grantBonusXp — see there for why. */
  private async grantBonusXp(tx: Tx, userId: string, baseXp: number): Promise<LevelUpInfo> {
    if (baseXp <= 0) return { leveledUp: false, newLevel: 0, newGrade: "" };
    const multiplierBps = await this.events.getActiveXpMultiplierBps(tx);
    const effectiveXp = Math.round((baseXp * multiplierBps) / 10_000);
    const levelUp = await grantXp(tx, userId, effectiveXp, (l) => this.grades.gradeForLevel(l));
    await this.seasons.bumpPoints(tx, userId, effectiveXp);
    await this.guildWars.bumpPoints(tx, userId, effectiveXp);
    return levelUp;
  }

  /**
   * The single ACTIVE seasonal quest, with this player's progress on every
   * step — including steps they haven't reached yet (goalCount/rewards are
   * shown up front so the questline reads as a story, not a fog of war;
   * `progress` on an unreached step just stays 0). Returns null when no
   * quest is currently running.
   */
  async getActiveQuest(userId: string) {
    const quest = await this.prisma.seasonalQuest.findFirst({
      where: { status: "ACTIVE" },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!quest) return null;

    const progressRows = await this.prisma.userQuestProgress.findMany({
      where: { userId, questStepId: { in: quest.steps.map((s) => s.id) } },
    });
    const byStepId = new Map(progressRows.map((p) => [p.questStepId, p]));

    return {
      id: quest.id,
      slug: quest.slug,
      title: quest.title,
      description: quest.description,
      startsAt: quest.startsAt,
      endsAt: quest.endsAt,
      steps: quest.steps.map((step) => {
        const p = byStepId.get(step.id);
        return {
          id: step.id,
          order: step.order,
          title: step.title,
          narrative: step.narrative,
          goalType: step.goalType,
          goalCount: step.goalCount,
          rewardCr: step.rewardCr,
          rewardXp: step.rewardXp,
          progress: p?.progress ?? 0,
          completedAt: p?.completedAt ?? null,
          claimedAt: p?.claimedAt ?? null,
        };
      }),
    };
  }

  async claimStep(userId: string, questStepId: string) {
    return this.prisma.$transaction(async (tx) => {
      const progress = await tx.userQuestProgress.findUnique({
        where: { userId_questStepId: { userId, questStepId } },
        include: { questStep: { include: { quest: { include: { steps: true } } } } },
      });
      if (!progress) throw new NotFoundException("Quest step progress not found");
      if (!progress.completedAt) throw new BadRequestException("This step isn't completed yet");
      if (progress.claimedAt) throw new BadRequestException("Reward already claimed");

      const step = progress.questStep;
      if (step.rewardCr > 0) {
        await this.wallet.credit(tx, {
          userId,
          amount: step.rewardCr,
          type: "QUEST_REWARD",
          referenceType: "UserQuestProgress",
          referenceId: progress.id,
          idempotencyKey: `quest-claim-${progress.id}`,
        });
      }
      const levelUp = await this.grantBonusXp(tx, userId, step.rewardXp);

      const updated = await tx.userQuestProgress.update({ where: { id: progress.id }, data: { claimedAt: new Date() } });

      await this.notifications.create(tx, userId, "QUEST_STEP_COMPLETED", {
        questId: step.questId,
        stepId: step.id,
        title: step.title,
        rewardCr: step.rewardCr,
        rewardXp: step.rewardXp,
      });

      const isLastStep = step.order === Math.max(...step.quest.steps.map((s) => s.order));
      if (isLastStep) {
        await this.notifications.create(tx, userId, "QUEST_COMPLETED", { questId: step.questId, title: step.quest.title });
      }
      if (levelUp.leveledUp) {
        await this.notifications.create(tx, userId, "LEVEL_UP", { newLevel: levelUp.newLevel, newGrade: levelUp.newGrade });
      }

      return { ...updated, ...levelUp };
    });
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listAllForAdmin() {
    return this.prisma.seasonalQuest.findMany({
      orderBy: { createdAt: "desc" },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  }

  /**
   * Authors an entire questline in one shot — a season is never half-
   * written mid-play. Creating one ACTIVE automatically archives whatever
   * else was active, so at most one questline ever runs at a time.
   */
  async create(data: {
    slug: string;
    title: string;
    description: string;
    steps: { order: number; title: string; narrative: string; goalType: string; goalCount: number; rewardCr?: number; rewardXp?: number }[];
  }) {
    if (data.steps.length === 0) throw new BadRequestException("A quest needs at least one step");
    const orders = data.steps.map((s) => s.order);
    if (new Set(orders).size !== orders.length) throw new ConflictException("Step order values must be unique");

    return this.prisma.$transaction(async (tx) => {
      await tx.seasonalQuest.updateMany({ where: { status: "ACTIVE" }, data: { status: "ARCHIVED" } });
      return tx.seasonalQuest.create({
        data: {
          slug: data.slug,
          title: data.title,
          description: data.description,
          status: "ACTIVE",
          steps: { create: data.steps.map((s) => ({ ...s, goalType: s.goalType as Prisma.QuestStepCreateInput["goalType"] })) },
        },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    });
  }

  async archive(id: string) {
    const quest = await this.prisma.seasonalQuest.findUnique({ where: { id } });
    if (!quest) throw new NotFoundException("Quest not found");
    return this.prisma.seasonalQuest.update({ where: { id }, data: { status: "ARCHIVED" } });
  }
}
