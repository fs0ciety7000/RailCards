import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type CardInstanceState } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Owned card instances, stacked by (cardDefinitionId, state, isFoil) — a
   * player holding 5 copies of the same card in the same state sees one
   * grouped entry with a count, not 5 separate tiles. Foil and non-foil
   * copies of the same card stack separately, same as two different
   * rarities would — a foil is a distinct collectible, not an attribute of
   * the base stack. The grouping (and its count) happens in SQL, and
   * pagination applies to the resulting groups, not the raw instance rows —
   * otherwise duplicates split across a page boundary would silently stop
   * stacking once a collection outgrew a single page.
   *
   * A signature instance never stacks, not even with another signature copy
   * of the same card — each one carries its own individually meaningful
   * "N/M" numbering, so folding it into (or behind) a count badge would hide
   * exactly what makes it worth showing. The CASE-on-id term below is NULL
   * (so ordinary duplicates keep grouping together) unless isSignature is
   * true, where it becomes the row's own id and forces a group of one.
   */
  async listInventory(
    userId: string,
    params: { page: number; pageSize: number; seriesId?: string; rarityCode?: string; state?: CardInstanceState },
  ) {
    const seriesFilter = params.seriesId ? Prisma.sql`AND cd."seriesId" = ${params.seriesId}` : Prisma.empty;
    const rarityFilter = params.rarityCode ? Prisma.sql`AND r.code = ${params.rarityCode}` : Prisma.empty;
    const stateFilter = params.state ? Prisma.sql`AND ci.state = ${params.state}::"CardInstanceState"` : Prisma.empty;
    const offset = (params.page - 1) * params.pageSize;

    const groups = await this.prisma.$queryRaw<
      { cardDefinitionId: string; state: CardInstanceState; count: number; representativeId: string }[]
    >`
      SELECT
        ci."cardDefinitionId",
        ci.state,
        COUNT(*)::int AS count,
        (array_agg(ci.id ORDER BY ci."acquiredAt" DESC))[1] AS "representativeId"
      FROM "CardInstance" ci
      JOIN "CardDefinition" cd ON cd.id = ci."cardDefinitionId"
      JOIN "Rarity" r ON r.id = cd."rarityId"
      WHERE ci."ownerId" = ${userId} ${seriesFilter} ${rarityFilter} ${stateFilter}
      GROUP BY ci."cardDefinitionId", ci.state, ci."isFoil", (CASE WHEN ci."isSignature" THEN ci.id END)
      ORDER BY MAX(ci."acquiredAt") DESC
      LIMIT ${params.pageSize} OFFSET ${offset}
    `;

    const [totalResult, instances] = await Promise.all([
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT 1
          FROM "CardInstance" ci
          JOIN "CardDefinition" cd ON cd.id = ci."cardDefinitionId"
          JOIN "Rarity" r ON r.id = cd."rarityId"
          WHERE ci."ownerId" = ${userId} ${seriesFilter} ${rarityFilter} ${stateFilter}
          GROUP BY ci."cardDefinitionId", ci.state, ci."isFoil", (CASE WHEN ci."isSignature" THEN ci.id END)
        ) t
      `,
      groups.length > 0
        ? this.prisma.cardInstance.findMany({
            where: { id: { in: groups.map((g) => g.representativeId) } },
            include: { cardDefinition: { include: { series: true, rarity: true } } },
          })
        : Promise.resolve([]),
    ]);

    const instanceById = new Map(instances.map((i) => [i.id, i]));
    const items = groups
      .map((g) => {
        const instance = instanceById.get(g.representativeId);
        return instance ? { ...instance, count: g.count } : null;
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    return { items, total: totalResult[0]?.count ?? 0 };
  }

  async getInstanceDetail(userId: string, instanceId: string) {
    const instance = await this.prisma.cardInstance.findUnique({
      where: { id: instanceId },
      include: { cardDefinition: { include: { series: true, rarity: true } }, owner: { select: { username: true } } },
    });
    if (!instance) throw new NotFoundException("Card instance not found");
    // Ownership is not required to view detail (useful for market/trade
    // previews of someone else's card) but we flag it for the client.
    return { ...instance, isOwnedByRequester: instance.ownerId === userId };
  }

  async getAlbum(userId: string) {
    const series = await this.prisma.cardSeries.findMany({
      where: { isActive: true },
      include: { cards: { where: { status: "PUBLISHED" }, select: { id: true } } },
    });

    const owned = await this.prisma.cardInstance.findMany({
      where: { ownerId: userId },
      distinct: ["cardDefinitionId"],
      select: { cardDefinitionId: true },
    });
    const ownedSet = new Set(owned.map((o) => o.cardDefinitionId));

    return series.map((s) => {
      const totalCards = s.cards.length;
      const ownedCards = s.cards.filter((c) => ownedSet.has(c.id)).length;
      return {
        seriesId: s.id,
        slug: s.slug,
        name: s.name,
        category: s.category,
        coverImageUrl: s.coverImageUrl,
        totalCards,
        ownedUniqueCards: ownedCards,
        completionPct: totalCards === 0 ? 0 : Math.round((ownedCards / totalCards) * 100),
      };
    });
  }

  /**
   * Every published card in a series, panini-album style: owned ones
   * reveal their art, missing ones are flagged `owned: false` with
   * `imageUrl` withheld so the frontend can render a silhouette instead
   * of spoiling art the player hasn't earned yet.
   */
  async getAlbumSeries(userId: string, seriesId: string) {
    const series = await this.prisma.cardSeries.findUnique({ where: { id: seriesId } });
    if (!series) throw new NotFoundException("Series not found");

    const [cards, owned] = await Promise.all([
      this.prisma.cardDefinition.findMany({
        where: { seriesId, status: "PUBLISHED" },
        include: { rarity: true },
        orderBy: [{ rarity: { order: "asc" } }, { name: "asc" }],
      }),
      this.prisma.cardInstance.findMany({
        where: { ownerId: userId, cardDefinition: { seriesId } },
        distinct: ["cardDefinitionId"],
        select: { cardDefinitionId: true },
      }),
    ]);
    const ownedSet = new Set(owned.map((o) => o.cardDefinitionId));

    return {
      seriesId: series.id,
      name: series.name,
      category: series.category,
      cards: cards.map((c) => {
        const isOwned = ownedSet.has(c.id);
        return {
          id: c.id,
          slug: c.slug,
          name: isOwned ? c.name : null,
          rarity: c.rarity,
          imageUrl: isOwned ? c.imageUrl : null,
          owned: isOwned,
        };
      }),
    };
  }

  /**
   * Every published card `userId` doesn't yet own, across every active
   * series — a practical hunting checklist, deliberately showing full card
   * details (name, art, rarity) rather than the album's spoiler-safe
   * silhouettes, since the whole point here is knowing exactly what to look
   * for. `seriesId`, when given, narrows to a single series.
   */
  async getMissingCards(userId: string, seriesId?: string) {
    const series = await this.prisma.cardSeries.findMany({
      where: { isActive: true, ...(seriesId ? { id: seriesId } : {}) },
      include: { cards: { where: { status: "PUBLISHED" }, include: { rarity: true }, orderBy: [{ rarity: { order: "asc" } }, { name: "asc" }] } },
      orderBy: { name: "asc" },
    });

    const owned = await this.prisma.cardInstance.findMany({
      where: { ownerId: userId, ...(seriesId ? { cardDefinition: { seriesId } } : {}) },
      distinct: ["cardDefinitionId"],
      select: { cardDefinitionId: true },
    });
    const ownedSet = new Set(owned.map((o) => o.cardDefinitionId));

    return series
      .map((s) => {
        const missingCards = s.cards
          .filter((c) => !ownedSet.has(c.id))
          .map((c) => ({ id: c.id, slug: c.slug, name: c.name, imageUrl: c.imageUrl, rarity: c.rarity }));
        return {
          seriesId: s.id,
          name: s.name,
          category: s.category,
          coverImageUrl: s.coverImageUrl,
          totalCards: s.cards.length,
          missingCount: missingCards.length,
          missingCards,
        };
      })
      .filter((s) => s.totalCards > 0);
  }
}
