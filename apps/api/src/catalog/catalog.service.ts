import { Injectable, NotFoundException } from "@nestjs/common";
import type { CardCategory, CardStatus, Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

export interface CardSearchParams {
  page: number;
  pageSize: number;
  search?: string;
  seriesId?: string;
  rarityCode?: string;
  category?: CardCategory;
  status?: CardStatus;
}

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
        orderBy: [{ rarity: { order: "asc" } }, { name: "asc" }],
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
}
