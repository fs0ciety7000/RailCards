import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LoreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The flavor-text "lore book": every published card that actually has
   * ambiance text, grouped by series, presented as an encyclopedia entry
   * per card. The card itself (name, art, rarity) is always visible — it's
   * a table of contents — but the flavor text is redacted until `userId`
   * owns at least one copy, so reading a card's lore is something you
   * unlock through play rather than something you could browse cold.
   * `seriesId`, when given, narrows to a single series.
   */
  async getBook(userId: string, seriesId?: string) {
    const series = await this.prisma.cardSeries.findMany({
      where: { isActive: true, ...(seriesId ? { id: seriesId } : {}) },
      include: {
        cards: {
          where: { status: "PUBLISHED", flavorText: { not: null }, NOT: { flavorText: "" } },
          include: { rarity: true },
          orderBy: [{ rarity: { order: "asc" } }, { name: "asc" }],
        },
      },
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
        const entries = s.cards.map((c) => {
          const unlocked = ownedSet.has(c.id);
          return {
            id: c.id,
            slug: c.slug,
            name: c.name,
            imageUrl: c.imageUrl,
            rarity: c.rarity,
            flavorText: unlocked ? c.flavorText : null,
            unlocked,
          };
        });
        return {
          seriesId: s.id,
          name: s.name,
          category: s.category,
          coverImageUrl: s.coverImageUrl,
          totalEntries: entries.length,
          unlockedCount: entries.filter((e) => e.unlocked).length,
          entries,
        };
      })
      .filter((s) => s.totalEntries > 0);
  }
}
