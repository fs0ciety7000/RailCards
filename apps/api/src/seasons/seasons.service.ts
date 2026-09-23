import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findActive(client: PrismaService | Tx) {
    return client.season.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  }

  async getActive() {
    return this.findActive(this.prisma);
  }

  /**
   * Adds `points` to `userId`'s tally for whichever season is ACTIVE right
   * now, inside the caller's transaction. Called alongside every XP grant
   * (mission/achievement/quest claims) with the same amount, so the
   * seasonal leaderboard tracks the same progress as permanent XP/level —
   * it just resets to zero each time a season restarts, instead of
   * accumulating forever. A no-op when no season is running.
   */
  async bumpPoints(tx: Tx, userId: string, points: number): Promise<void> {
    if (points <= 0) return;
    const season = await this.findActive(tx);
    if (!season) return;
    await tx.seasonPoint.upsert({
      where: { seasonId_userId: { seasonId: season.id, userId } },
      update: { points: { increment: points } },
      create: { seasonId: season.id, userId, points },
    });
  }

  async leaderboard(limit = 50) {
    const season = await this.getActive();
    if (!season) return { season: null, entries: [] };

    const rows = await this.prisma.seasonPoint.findMany({
      where: { seasonId: season.id },
      orderBy: { points: "desc" },
      take: limit,
      include: { user: { select: { username: true, displayName: true, avatarUrl: true, role: true } } },
    });
    return {
      season: { id: season.id, name: season.name, startedAt: season.startedAt },
      entries: rows.map((r, i) => ({
        rank: i + 1,
        username: r.user.username,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
        role: r.user.role,
        points: r.points,
      })),
    };
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listAllForAdmin() {
    return this.prisma.season.findMany({ orderBy: { startedAt: "desc" } });
  }

  /** Ends whatever season is currently active (if any) and starts a fresh one — the leaderboard "reset". */
  async startNewSeason(name: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.season.updateMany({ where: { status: "ACTIVE" }, data: { status: "ENDED", endedAt: new Date() } });
      return tx.season.create({ data: { name } });
    });
  }

  async endActiveSeason() {
    const season = await this.getActive();
    if (!season) throw new NotFoundException("No season is currently active");
    return this.prisma.season.update({ where: { id: season.id }, data: { status: "ENDED", endedAt: new Date() } });
  }
}
