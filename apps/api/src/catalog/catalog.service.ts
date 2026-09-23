import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CardCategory, CardStatus, Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

export type CardSortBy = "rarity" | "name" | "status" | "newest";

export interface CardSearchParams {
  page: number;
  pageSize: number;
  search?: string;
  seriesId?: string;
  rarityCode?: string;
  category?: CardCategory;
  status?: CardStatus;
  sortBy?: CardSortBy;
}

const CARD_ORDER_BY: Record<CardSortBy, Prisma.CardDefinitionOrderByWithRelationInput[]> = {
  rarity: [{ rarity: { order: "asc" } }, { name: "asc" }],
  name: [{ name: "asc" }],
  // Enum sort order follows declaration order (DRAFT, PUBLISHED, ARCHIVED)
  // — draft cards still needing attention float to the top.
  status: [{ status: "asc" }, { name: "asc" }],
  newest: [{ createdAt: "desc" }],
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listRarities() {
    return this.prisma.rarity.findMany({ orderBy: { order: "asc" } });
  }

  async listSeries() {
    return this.prisma.cardSeries.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { cards: true } } },
    });
  }

  async searchCards(params: CardSearchParams, includeAllStatuses: boolean) {
    const where: Prisma.CardDefinitionWhereInput = {
      status: includeAllStatuses ? params.status : (params.status ?? "PUBLISHED"),
      seriesId: params.seriesId,
      category: params.category,
      rarity: params.rarityCode ? { code: params.rarityCode } : undefined,
      OR: params.search
        ? [
            { name: { contains: params.search, mode: "insensitive" } },
            { description: { contains: params.search, mode: "insensitive" } },
          ]
        : undefined,
    };
    if (!includeAllStatuses) {
      where.status = "PUBLISHED";
    }

    const [items, total] = await Promise.all([
      this.prisma.cardDefinition.findMany({
        where,
        include: { series: true, rarity: true },
        orderBy: CARD_ORDER_BY[params.sortBy ?? "rarity"],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.cardDefinition.count({ where }),
    ]);

    return { items, total };
  }

  async getCardById(id: string, includeAllStatuses: boolean) {
    const card = await this.prisma.cardDefinition.findUnique({
      where: { id },
      include: { series: true, rarity: true },
    });
    if (!card) throw new NotFoundException("Card not found");
    if (!includeAllStatuses && card.status !== "PUBLISHED") {
      throw new NotFoundException("Card not found");
    }
    return card;
  }

  // ── Admin write operations ──────────────────────────────────────────

  async createSeries(data: Prisma.CardSeriesCreateInput) {
    return this.prisma.cardSeries.create({ data });
  }

  async updateSeries(id: string, data: Prisma.CardSeriesUpdateInput) {
    return this.prisma.cardSeries.update({ where: { id }, data });
  }

  async listAllSeriesForAdmin() {
    return this.prisma.cardSeries.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { cards: true } } } });
  }

  async createCard(data: Prisma.CardDefinitionCreateInput) {
    return this.prisma.cardDefinition.create({ data, include: { series: true, rarity: true } });
  }

  async updateCard(id: string, data: Prisma.CardDefinitionUpdateInput) {
    return this.prisma.cardDefinition.update({ where: { id }, data, include: { series: true, rarity: true } });
  }

  async setCardStatus(id: string, status: CardStatus) {
    return this.prisma.cardDefinition.update({ where: { id }, data: { status }, include: { series: true, rarity: true } });
  }

  /**
   * Hard-deletes a card definition. Refuses outright if any of its owned
   * instances are mid-trade or mid-sale (that would silently void another
   * player's in-flight transaction) — the admin must wait or cancel those
   * first. If instances exist and `cascade` isn't set, refuses with the
   * count so the admin sees the blast radius before confirming; `cascade`
   * then deletes every owned instance (and its trade/market/booster-pull
   * history) along with the card itself, in one transaction.
   */
  async deleteCard(id: string, cascade: boolean) {
    const card = await this.prisma.cardDefinition.findUnique({ where: { id } });
    if (!card) throw new NotFoundException("Card not found");

    const instanceCount = await this.prisma.cardInstance.count({ where: { cardDefinitionId: id } });

    if (instanceCount > 0) {
      const reservedCount = await this.prisma.cardInstance.count({
        where: { cardDefinitionId: id, state: { in: ["RESERVED_TRADE", "RESERVED_MARKET"] } },
      });
      if (reservedCount > 0) {
        throw new ConflictException(
          `${reservedCount} exemplaire(s) sont actuellement réservés (échange ou vente en cours) — attendez leur résolution ou annulez-les avant de supprimer cette carte.`,
        );
      }
      if (!cascade) {
        throw new ConflictException(
          `${instanceCount} exemplaire(s) de cette carte existent dans des collections de joueurs. Confirmez la suppression en cascade pour les retirer aussi.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const instanceIds = (await tx.cardInstance.findMany({ where: { cardDefinitionId: id }, select: { id: true } })).map(
        (i) => i.id,
      );

      if (instanceIds.length > 0) {
        const listingIds = (
          await tx.marketListing.findMany({ where: { cardInstanceId: { in: instanceIds } }, select: { id: true } })
        ).map((l) => l.id);
        if (listingIds.length > 0) {
          await tx.marketTransaction.deleteMany({ where: { listingId: { in: listingIds } } });
          await tx.marketListing.deleteMany({ where: { id: { in: listingIds } } });
        }
        await tx.tradeItem.deleteMany({ where: { cardInstanceId: { in: instanceIds } } });
        await tx.duel.deleteMany({
          where: { OR: [{ challengerCardInstanceId: { in: instanceIds } }, { opponentCardInstanceId: { in: instanceIds } }] },
        });
      }

      // Every booster pull for this card is tied via cardDefinitionId
      // directly, whether or not its instance still exists above.
      await tx.boosterPull.deleteMany({ where: { cardDefinitionId: id } });
      await tx.boosterPoolEntry.deleteMany({ where: { cardDefinitionId: id } });

      if (instanceIds.length > 0) {
        await tx.cardInstance.deleteMany({ where: { id: { in: instanceIds } } });
      }

      await tx.cardDefinition.delete({ where: { id } });
    });

    return { deleted: true, instancesRemoved: instanceCount };
  }
}
