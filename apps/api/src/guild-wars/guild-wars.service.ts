import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { NotificationsService } from "../notifications/notifications.service";

type Tx = Prisma.TransactionClient;

const RANK_REWARD_CR = [
  GAME_CONSTANTS.GUILD_WAR_REWARD_CR_RANK_1,
  GAME_CONSTANTS.GUILD_WAR_REWARD_CR_RANK_2,
  GAME_CONSTANTS.GUILD_WAR_REWARD_CR_RANK_3,
] as const;

@Injectable()
export class GuildWarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  private async findActive(client: PrismaService | Tx) {
    return client.guildWarPeriod.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  }

  async getActive() {
    return this.findActive(this.prisma);
  }

  /**
   * Adds `points` to `userId`'s guild's tally for whichever war period is
   * ACTIVE right now, inside the caller's transaction — called alongside
   * every XP grant (mission/achievement/quest claims), same shape as
   * SeasonsService.bumpPoints. A no-op when no period is running or the
   * player isn't in a guild.
   */
  async bumpPoints(tx: Tx, userId: string, points: number): Promise<void> {
    if (points <= 0) return;
    const period = await this.findActive(tx);
    if (!period) return;
    const membership = await tx.guildMember.findUnique({ where: { userId } });
    if (!membership) return;
    await tx.guildWarPoint.upsert({
      where: { periodId_guildId: { periodId: period.id, guildId: membership.guildId } },
      update: { points: { increment: points } },
      create: { periodId: period.id, guildId: membership.guildId, points },
    });
  }

  async leaderboard(limit = 50) {
    const period = await this.getActive();
    if (!period) return { period: null, entries: [] };

    const rows = await this.prisma.guildWarPoint.findMany({
      where: { periodId: period.id },
      orderBy: { points: "desc" },
      take: limit,
      include: { guild: { select: { id: true, name: true, tag: true, _count: { select: { members: true } } } } },
    });
    return {
      period: { id: period.id, name: period.name, startedAt: period.startedAt },
      entries: rows.map((r, i) => ({
        rank: i + 1,
        guildId: r.guild.id,
        name: r.guild.name,
        tag: r.guild.tag,
        memberCount: r.guild._count.members,
        points: r.points,
      })),
    };
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listAllForAdmin() {
    return this.prisma.guildWarPeriod.findMany({ orderBy: { startedAt: "desc" } });
  }

  /**
   * Pays every member of the top-3 guilds (by rank, scaled down) and
   * notifies them, then marks the period ENDED. Shared by both
   * startNewPeriod (reset) and endActivePeriod (manual stop) so a period
   * is never reset without its rewards being paid out first.
   */
  private async endAndReward(tx: Tx, period: { id: string }) {
    const top = await tx.guildWarPoint.findMany({
      where: { periodId: period.id },
      orderBy: { points: "desc" },
      take: 3,
      include: { guild: { select: { id: true, name: true, members: { select: { userId: true } } } } },
    });

    for (let i = 0; i < top.length; i++) {
      const row = top[i]!;
      const rewardCr = RANK_REWARD_CR[i]!;
      if (row.points <= 0) continue;
      for (const member of row.guild.members) {
        await this.wallet.credit(tx, {
          userId: member.userId,
          amount: rewardCr,
          type: "GUILD_WAR_REWARD",
          referenceType: "GuildWarPeriod",
          referenceId: period.id,
          idempotencyKey: `guild-war-reward-${period.id}-${member.userId}`,
        });
        await this.notifications.create(tx, member.userId, "GUILD_WAR_REWARD", {
          periodId: period.id,
          guildId: row.guild.id,
          guildName: row.guild.name,
          rank: i + 1,
          rewardCr,
        });
      }
    }

    await tx.guildWarPeriod.update({ where: { id: period.id }, data: { status: "ENDED", endedAt: new Date() } });
  }

  /** Ends whatever war period is currently active (paying its rewards, if any) and starts a fresh one. */
  async startNewPeriod(name: string) {
    return this.prisma.$transaction(async (tx) => {
      const active = await this.findActive(tx);
      if (active) await this.endAndReward(tx, active);
      return tx.guildWarPeriod.create({ data: { name } });
    });
  }

  async endActivePeriod() {
    const period = await this.getActive();
    if (!period) throw new NotFoundException("No guild war period is currently active");
    return this.prisma.$transaction(async (tx) => {
      await this.endAndReward(tx, period);
      return tx.guildWarPeriod.findUniqueOrThrow({ where: { id: period.id } });
    });
  }
}
