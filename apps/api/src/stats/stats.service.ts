import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface WalletActivityRow {
  creditsEarned: number;
  creditsSpent: number;
  activeDays: number;
}

interface CollectionRow {
  totalCardsPulled: number;
  totalBoostersOpened: number;
}

interface TopPulledCardRow {
  cardDefinitionId: string;
  name: string;
  imageUrl: string;
  rarityCode: string;
  rarityLabel: string;
  rarityColorHex: string;
  pullCount: number;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Personal stats for a player's own dedicated stats page: CR earned/spent
   * (from the wallet ledger, which already records every source and sink),
   * cards most often pulled from boosters, and "jours actifs" — a distinct-
   * day count of wallet activity, used in place of session-duration
   * "playtime" since RailCards doesn't track session length anywhere; this
   * is a deliberately honest substitute rather than a fabricated metric.
   */
  async myStats(userId: string) {
    const [walletActivity] = await this.prisma.$queryRaw<WalletActivityRow[]>`
      SELECT
        COALESCE(SUM(wt.amount) FILTER (WHERE wt.amount > 0), 0)::int AS "creditsEarned",
        COALESCE(SUM(-wt.amount) FILTER (WHERE wt.amount < 0), 0)::int AS "creditsSpent",
        COUNT(DISTINCT DATE(wt."createdAt"))::int AS "activeDays"
      FROM "WalletTransaction" wt
      JOIN "Wallet" w ON w.id = wt."walletId"
      WHERE w."userId" = ${userId}
    `;

    const [collection] = await this.prisma.$queryRaw<CollectionRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "BoosterPull" bp JOIN "BoosterOpening" bo ON bo.id = bp."boosterOpeningId" WHERE bo."userId" = ${userId})::int AS "totalCardsPulled",
        (SELECT COUNT(*) FROM "BoosterOpening" WHERE "userId" = ${userId})::int AS "totalBoostersOpened"
    `;

    const topPulledCards = await this.prisma.$queryRaw<TopPulledCardRow[]>`
      SELECT
        cd.id AS "cardDefinitionId", cd.name, cd."imageUrl",
        r.code AS "rarityCode", r.label AS "rarityLabel", r."colorHex" AS "rarityColorHex",
        COUNT(*)::int AS "pullCount"
      FROM "BoosterPull" bp
      JOIN "BoosterOpening" bo ON bo.id = bp."boosterOpeningId"
      JOIN "CardDefinition" cd ON cd.id = bp."cardDefinitionId"
      JOIN "Rarity" r ON r.id = bp."rarityId"
      WHERE bo."userId" = ${userId}
      GROUP BY cd.id, cd.name, cd."imageUrl", r.code, r.label, r."colorHex"
      ORDER BY "pullCount" DESC, cd.name ASC
      LIMIT 10
    `;

    return {
      creditsEarned: walletActivity?.creditsEarned ?? 0,
      creditsSpent: walletActivity?.creditsSpent ?? 0,
      activeDays: walletActivity?.activeDays ?? 0,
      totalCardsPulled: collection?.totalCardsPulled ?? 0,
      totalBoostersOpened: collection?.totalBoostersOpened ?? 0,
      topPulledCards: topPulledCards.map((row) => ({
        cardDefinitionId: row.cardDefinitionId,
        name: row.name,
        imageUrl: row.imageUrl,
        rarity: { code: row.rarityCode, label: row.rarityLabel, colorHex: row.rarityColorHex },
        pullCount: row.pullCount,
      })),
    };
  }
}
