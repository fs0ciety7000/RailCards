import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { MissionsService } from "../missions/missions.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly missions: MissionsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async createListing(sellerId: string, cardInstanceId: string, priceCr: number) {
    if (!Number.isInteger(priceCr) || priceCr < GAME_CONSTANTS.MARKET_LISTING_MIN_PRICE_CR) {
      throw new BadRequestException(`Price must be an integer of at least ${GAME_CONSTANTS.MARKET_LISTING_MIN_PRICE_CR} CR`);
    }
    const feeBps = this.config.get<number>("MARKET_FEE_BPS") ?? GAME_CONSTANTS.DEFAULT_MARKET_FEE_BPS;

    return this.prisma.$transaction(async (tx) => {
      const reserveResult = await tx.cardInstance.updateMany({
        where: { id: cardInstanceId, ownerId: sellerId, state: "AVAILABLE" },
        data: { state: "RESERVED_MARKET" },
      });
      if (reserveResult.count === 0) {
        throw new ConflictException("This card is not available to list (already listed, traded, or not yours)");
      }
      return tx.marketListing.create({
        data: { sellerId, cardInstanceId, priceCr, feeBps, status: "ACTIVE" },
        include: { cardInstance: { include: { cardDefinition: { include: { rarity: true } } } } },
      });
    });
  }

  async cancelListing(sellerId: string, listingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({ where: { id: listingId } });
      if (!listing) throw new NotFoundException("Listing not found");
      if (listing.sellerId !== sellerId) throw new ForbiddenException("Only the seller can cancel this listing");

      const result = await tx.marketListing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (result.count === 0) throw new ConflictException("This listing is no longer active");

      await tx.cardInstance.updateMany({
        where: { id: listing.cardInstanceId, state: "RESERVED_MARKET" },
        data: { state: "AVAILABLE" },
      });
      return tx.marketListing.findUniqueOrThrow({ where: { id: listingId } });
    });
  }

  async listActive(params: {
    page: number;
    pageSize: number;
    search?: string;
    seriesId?: string;
    rarityCode?: string;
    sort?: "price_asc" | "price_desc" | "recent";
  }) {
    const where = {
      status: "ACTIVE" as const,
      cardInstance: {
        cardDefinition: {
          seriesId: params.seriesId,
          rarity: params.rarityCode ? { code: params.rarityCode } : undefined,
          name: params.search ? { contains: params.search, mode: "insensitive" as const } : undefined,
        },
      },
    };
    const orderBy =
      params.sort === "price_asc"
        ? { priceCr: "asc" as const }
        : params.sort === "price_desc"
          ? { priceCr: "desc" as const }
          : { createdAt: "desc" as const };

    const [items, total] = await Promise.all([
      this.prisma.marketListing.findMany({
        where,
        include: {
          cardInstance: { include: { cardDefinition: { include: { rarity: true, series: true } } } },
          seller: { select: { username: true, displayName: true } },
        },
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.marketListing.count({ where }),
    ]);
    return { items, total };
  }

  async getListingById(listingId: string) {
    const listing = await this.prisma.marketListing.findUnique({
      where: { id: listingId },
      include: {
        cardInstance: { include: { cardDefinition: { include: { rarity: true, series: true } } } },
        seller: { select: { username: true, displayName: true } },
      },
    });
    if (!listing) throw new NotFoundException("Listing not found");
    return listing;
  }

  async buy(buyerId: string, listingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: { cardInstance: { select: { cardDefinitionId: true } } },
      });
      if (!listing) throw new NotFoundException("Listing not found");
      if (listing.sellerId === buyerId) throw new BadRequestException("You cannot buy your own listing");

      const claim = await tx.marketListing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: { status: "SOLD", soldAt: new Date() },
      });
      if (claim.count === 0) {
        throw new ConflictException("This listing was just sold or cancelled by someone else");
      }

      const transferResult = await tx.cardInstance.updateMany({
        where: { id: listing.cardInstanceId, ownerId: listing.sellerId, state: "RESERVED_MARKET" },
        data: { ownerId: buyerId, state: "AVAILABLE", acquiredVia: "MARKET", acquiredAt: new Date() },
      });
      if (transferResult.count !== 1) {
        throw new ConflictException("The card behind this listing could not be transferred");
      }

      const feeCr = Math.floor((listing.priceCr * listing.feeBps) / 10_000);
      const sellerProceeds = listing.priceCr - feeCr;

      await this.wallet.debit(tx, {
        userId: buyerId,
        amount: listing.priceCr,
        type: "MARKET_PURCHASE",
        referenceType: "MarketListing",
        referenceId: listing.id,
        idempotencyKey: `market-buy-${listing.id}`,
      });
      if (sellerProceeds > 0) {
        await this.wallet.credit(tx, {
          userId: listing.sellerId,
          amount: sellerProceeds,
          type: "MARKET_SALE",
          referenceType: "MarketListing",
          referenceId: listing.id,
          idempotencyKey: `market-sale-${listing.id}`,
        });
      }
      // The commission (feeCr) is a currency sink: it is debited from the
      // buyer's full price but not re-credited to anyone, which is how
      // RailCards keeps CR from inflating indefinitely through trading.

      const marketTx = await tx.marketTransaction.create({
        data: { listingId: listing.id, buyerId, sellerId: listing.sellerId, priceCr: listing.priceCr, feeCr },
      });

      await this.missions.recordProgress(tx, listing.sellerId, "SELL_ON_MARKET", 1);
      await this.missions.recordProgress(tx, buyerId, "BUY_ON_MARKET", 1);
      await this.missions.checkSeriesCompletion(tx, buyerId, [listing.cardInstance.cardDefinitionId]);
      await this.notifications.create(tx, listing.sellerId, "MARKET_SOLD", { listingId: listing.id });

      return marketTx;
    });
  }

  async listMyTransactions(userId: string, page: number, pageSize: number) {
    const where = { OR: [{ buyerId: userId }, { sellerId: userId }] };
    const [items, total] = await Promise.all([
      this.prisma.marketTransaction.findMany({
        where,
        include: { listing: { include: { cardInstance: { include: { cardDefinition: true } } } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.marketTransaction.count({ where }),
    ]);
    return { items, total };
  }
}
