import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SeasonsService } from "../seasons/seasons.service";
import { grantXp } from "../missions/missions.service";
import { GradesService } from "../grades/grades.service";

@Injectable()
export class SeasonPassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
    private readonly seasons: SeasonsService,
    private readonly grades: GradesService,
  ) {}

  /**
   * The active season's tier ladder, each annotated with whether the
   * caller's current season tally has reached it and whether they've
   * already claimed it. Empty tier list (not null) when a season is
   * running but no tiers have been authored for it yet.
   */
  async listForPlayer(userId: string) {
    const season = await this.seasons.getActive();
    if (!season) return { season: null, points: 0, tiers: [] };

    const [tiers, seasonPoint, claims] = await Promise.all([
      this.prisma.seasonPassTier.findMany({ where: { seasonId: season.id }, orderBy: { tier: "asc" } }),
      this.prisma.seasonPoint.findUnique({ where: { seasonId_userId: { seasonId: season.id, userId } } }),
      this.prisma.seasonPassClaim.findMany({ where: { userId, tier: { seasonId: season.id } }, select: { tierId: true } }),
    ]);
    const points = seasonPoint?.points ?? 0;
    const claimedTierIds = new Set(claims.map((c) => c.tierId));

    return {
      season: { id: season.id, name: season.name, startedAt: season.startedAt },
      points,
      tiers: tiers.map((t) => ({
        id: t.id,
        tier: t.tier,
        pointsRequired: t.pointsRequired,
        rewardCr: t.rewardCr,
        rewardXp: t.rewardXp,
        rewardLabel: t.rewardLabel,
        unlocked: points >= t.pointsRequired,
        claimed: claimedTierIds.has(t.id),
      })),
    };
  }

  async claim(userId: string, tierId: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.seasonPassTier.findUnique({ where: { id: tierId }, include: { season: true } });
      if (!t) throw new NotFoundException("Season pass tier not found");
      if (t.season.status !== "ACTIVE") throw new ForbiddenException("This tier belongs to a season that has ended");

      const already = await tx.seasonPassClaim.findUnique({ where: { tierId_userId: { tierId, userId } } });
      if (already) throw new BadRequestException("Reward already claimed");

      const seasonPoint = await tx.seasonPoint.findUnique({ where: { seasonId_userId: { seasonId: t.seasonId, userId } } });
      if ((seasonPoint?.points ?? 0) < t.pointsRequired) {
        throw new BadRequestException("You have not reached this tier's point threshold yet");
      }

      if (t.rewardCr > 0) {
        await this.wallet.credit(tx, {
          userId,
          amount: t.rewardCr,
          type: "SEASON_PASS_REWARD",
          referenceType: "SeasonPassTier",
          referenceId: t.id,
          idempotencyKey: `season-pass-claim-${t.id}-${userId}`,
        });
      }
      // A flat grant, not routed through the event-multiplier/season-bump
      // helper: the reward is earned FROM season points, so feeding it
      // back into the same tally would be a (harmless but confusing)
      // feedback loop. Same reasoning as the daily reward's plain grant.
      const levelUp = t.rewardXp > 0 ? await grantXp(tx, userId, t.rewardXp, (l) => this.grades.gradeForLevel(l)) : null;

      const claim = await tx.seasonPassClaim.create({ data: { tierId, userId } });

      await this.notifications.create(tx, userId, "SEASON_PASS_REWARD", {
        tierId: t.id,
        tier: t.tier,
        rewardCr: t.rewardCr,
        rewardXp: t.rewardXp,
        rewardLabel: t.rewardLabel,
      });
      if (levelUp?.leveledUp) {
        await this.notifications.create(tx, userId, "LEVEL_UP", { newLevel: levelUp.newLevel, newGrade: levelUp.newGrade });
      }

      return { ...claim, leveledUp: levelUp?.leveledUp ?? false };
    });
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listForAdmin(seasonId?: string) {
    const season = seasonId ? await this.prisma.season.findUniqueOrThrow({ where: { id: seasonId } }) : await this.seasons.getActive();
    if (!season) return { season: null, tiers: [] };
    const tiers = await this.prisma.seasonPassTier.findMany({ where: { seasonId: season.id }, orderBy: { tier: "asc" } });
    return { season: { id: season.id, name: season.name, status: season.status }, tiers };
  }

  async createTier(data: { tier: number; pointsRequired: number; rewardCr?: number; rewardXp?: number; rewardLabel?: string }) {
    const season = await this.seasons.getActive();
    if (!season) throw new BadRequestException("No season is currently active to attach a pass tier to");
    const existing = await this.prisma.seasonPassTier.findUnique({ where: { seasonId_tier: { seasonId: season.id, tier: data.tier } } });
    if (existing) throw new ConflictException("A tier with this number already exists for the active season");
    return this.prisma.seasonPassTier.create({ data: { ...data, seasonId: season.id } });
  }

  async updateTier(id: string, data: { pointsRequired?: number; rewardCr?: number; rewardXp?: number; rewardLabel?: string }) {
    const tier = await this.prisma.seasonPassTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException("Season pass tier not found");
    return this.prisma.seasonPassTier.update({ where: { id }, data });
  }
}
