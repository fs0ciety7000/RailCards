import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const WANTED_INCLUDE = {
  poster: { select: { username: true, displayName: true } },
  cardDefinition: { include: { rarity: true, series: true } },
} as const;

@Injectable()
export class WantedListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(posterId: string, cardDefinitionId: string, note?: string) {
    const card = await this.prisma.cardDefinition.findUnique({ where: { id: cardDefinitionId } });
    if (!card) throw new NotFoundException("Card not found");
    if (card.status !== "PUBLISHED") throw new BadRequestException("You can only post a wanted listing for a published card");

    const existing = await this.prisma.wantedListing.findFirst({
      where: { posterId, cardDefinitionId, status: "OPEN" },
    });
    if (existing) throw new ConflictException("You already have an open wanted listing for this card");

    return this.prisma.wantedListing.create({
      data: { posterId, cardDefinitionId, note },
      include: WANTED_INCLUDE,
    });
  }

  /** The public board: every OPEN listing, newest first. */
  async listOpen(params: { page: number; pageSize: number; cardDefinitionId?: string; search?: string }) {
    const where = {
      status: "OPEN" as const,
      cardDefinitionId: params.cardDefinitionId,
      cardDefinition: params.search ? { name: { contains: params.search, mode: "insensitive" as const } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.wantedListing.findMany({
        where,
        include: WANTED_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.wantedListing.count({ where }),
    ]);
    return { items, total };
  }

  async listMine(posterId: string) {
    return this.prisma.wantedListing.findMany({
      where: { posterId },
      include: WANTED_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  private async transitionOwnListing(userId: string, id: string, to: "FULFILLED" | "CANCELLED") {
    const listing = await this.prisma.wantedListing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException("Wanted listing not found");
    if (listing.posterId !== userId) throw new ForbiddenException("Only the poster can update this listing");
    const result = await this.prisma.wantedListing.updateMany({
      where: { id, status: "OPEN" },
      data: { status: to },
    });
    if (result.count === 0) throw new ConflictException("This listing is no longer open");
    return this.prisma.wantedListing.findUniqueOrThrow({ where: { id }, include: WANTED_INCLUDE });
  }

  async fulfill(userId: string, id: string) {
    return this.transitionOwnListing(userId, id, "FULFILLED");
  }

  async cancel(userId: string, id: string) {
    return this.transitionOwnListing(userId, id, "CANCELLED");
  }
}
