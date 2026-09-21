import { Injectable, NotFoundException } from "@nestjs/common";
import type { CardInstanceState, Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  async listInventory(
    userId: string,
    params: { page: number; pageSize: number; seriesId?: string; rarityCode?: string; state?: CardInstanceState },
  ) {
    const where: Prisma.CardInstanceWhereInput = {
      ownerId: userId,
      state: params.state,
      cardDefinition: {
        seriesId: params.seriesId,
        rarity: params.rarityCode ? { code: params.rarityCode } : undefined,
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.cardInstance.findMany({
        where,
        include: { cardDefinition: { include: { series: true, rarity: true } } },
        orderBy: { acquiredAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.cardInstance.count({ where }),
    ]);

    return { items, total };
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
        totalCards,
        ownedUniqueCards: ownedCards,
        completionPct: totalCards === 0 ? 0 : Math.round((ownedCards / totalCards) * 100),
      };
    });
  }
}
