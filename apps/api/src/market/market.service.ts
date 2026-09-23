import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { MissionsService } from "../missions/missions.service";
import { NotificationsService } from "../notifications/notifications.service";

const LISTING_INCLUDE = {
  cardInstance: { include: { cardDefinition: { include: { rarity: true, series: true } } } },
  seller: { select: { username: true, displayName: true } },
  currentBidder: { select: { username: true, displayName: true } },
} as const;

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly missions: MissionsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async createListing(
    sellerId: string,
    cardInstanceId: string,
    priceCr: number,
    listingType: "FIXED" | "AUCTION" = "FIXED",
    durationHours?: number,
  ) {
    if (!Number.isInteger(priceCr) || priceCr < GAME_CONSTANTS.MARKET_LISTING_MIN_PRICE_CR) {
      throw new BadRequestException(`Price must be an integer of at least ${GAME_CONSTANTS.MARKET_LISTING_MIN_PRICE_CR} CR`);
    }
    const feeBps = this.config.get<number>("MARKET_FEE_BPS") ?? GAME_CONSTANTS.DEFAULT_MARKET_FEE_BPS;
    const auctionEndsAt =
      listingType === "AUCTION"
        ? new Date(Date.now() + (durationHours ?? GAME_CONSTANTS.AUCTION_DEFAULT_DURATION_HOURS) * 3_600_000)
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      const reserveResult = await tx.cardInstance.updateMany({
        where: { id: cardInstanceId, ownerId: sellerId, state: "AVAILABLE" },
        data: { state: "RESERVED_MARKET" },
      });
      if (reserveResult.count === 0) {
        throw new ConflictException("This card is not available to list (already listed, traded, or not yours)");
      }
      return tx.marketListing.create({
        data: { sellerId, cardInstanceId, priceCr, feeBps, status: "ACTIVE", listingType, auctionEndsAt },
        include: LISTING_INCLUDE,
      });
    });
  }

  async cancelListing(sellerId: string, listingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({ where: { id: listingId } });
      if (!listing) throw new NotFoundException("Listing not found");
      if (listing.sellerId !== sellerId) throw new ForbiddenException("Only the seller can cancel this listing");
      if (listing.listingType === "AUCTION" && listing.currentBidderId) {
        throw new ConflictException("This auction already has a bid and can no longer be cancelled");
      }

      const result = await tx.marketListing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (result.count === 0) throw new ConflictException("This listing is no longer active");

      await tx.cardInstance.updateMany({
        where: { id: listing.cardInstanceId, state: "RESERVED_MARKET" },
        data: { state: "AVAILABLE" },
      });
      return tx.marketListing.findUniqueOrThrow({ where: { id: listingId }, include: LISTING_INCLUDE });
    });
  }

  async listActive(params: {
    page: number;
    pageSize: number;
    search?: string;
    seriesId?: string;
    rarityCode?: string;
    listingType?: "FIXED" | "AUCTION";
    sort?: "price_asc" | "price_desc" | "recent";
  }) {
    const where = {
      status: "ACTIVE" as const,
      listingType: params.listingType,
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
        include: LISTING_INCLUDE,
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.marketListing.count({ where }),
    ]);
    return { items, total };
  }

  async getListingById(listingId: string) {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId }, include: LISTING_INCLUDE });
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
      if (listing.listingType === "AUCTION") throw new BadRequestException("This is an auction — place a bid instead");
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

  /**
   * Places a bid, escrowing it immediately (debited on placement, not at
   * auction close — unlike Duel wagers, an auction can run for days, far
   * too long a window to trust a bidder's balance will still be there at
   * settlement). Outbidding someone refunds their held escrow in the same
   * transaction. A compare-and-swap on the listing's cached leading bid
   * (read fresh, then updateMany matched on that exact value) makes
   * concurrent bids race-safe without a hand-rolled lock.
   */
  async placeBid(bidderId: string, listingId: string, amountCr: number) {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.listingType !== "AUCTION") throw new BadRequestException("This listing is not an auction");
    if (listing.sellerId === bidderId) throw new BadRequestException("You cannot bid on your own auction");
    if (listing.status !== "ACTIVE") throw new ConflictException("This auction is no longer active");

    if (listing.auctionEndsAt! <= new Date()) {
      await this.settleAuction(listingId);
      throw new BadRequestException("This auction has already ended");
    }

    const bidderBalance = (await this.prisma.wallet.findUnique({ where: { userId: bidderId } }))?.balance ?? 0;
    if (bidderBalance < amountCr) throw new BadRequestException("You do not have enough CR to place this bid");

    return this.prisma.$transaction(async (tx) => {
      const fresh = await tx.marketListing.findUnique({ where: { id: listingId } });
      if (!fresh || fresh.status !== "ACTIVE") throw new ConflictException("This auction is no longer active");
      if (fresh.auctionEndsAt! <= new Date()) throw new ConflictException("This auction has just ended");

      const minAllowed = fresh.currentBidCr != null ? fresh.currentBidCr + 1 : fresh.priceCr;
      if (amountCr < minAllowed) throw new BadRequestException(`Your bid must be at least ${minAllowed} CR`);

      const claim = await tx.marketListing.updateMany({
        where: { id: listingId, status: "ACTIVE", currentBidCr: fresh.currentBidCr },
        data: { currentBidCr: amountCr, currentBidderId: bidderId },
      });
      if (claim.count === 0) throw new ConflictException("Someone else just placed a bid — please retry");

      await this.wallet.debit(tx, {
        userId: bidderId,
        amount: amountCr,
        type: "AUCTION_BID_HOLD",
        referenceType: "MarketListing",
        referenceId: listingId,
        idempotencyKey: `auction-bid-${listingId}-${bidderId}-${amountCr}`,
      });

      if (fresh.currentBidderId && fresh.currentBidCr) {
        await this.wallet.credit(tx, {
          userId: fresh.currentBidderId,
          amount: fresh.currentBidCr,
          type: "AUCTION_BID_REFUND",
          referenceType: "MarketListing",
          referenceId: listingId,
          idempotencyKey: `auction-outbid-${listingId}-${fresh.currentBidderId}-${fresh.currentBidCr}`,
        });
        await this.notifications.create(tx, fresh.currentBidderId, "AUCTION_OUTBID", { listingId, newBidCr: amountCr });
      }

      await tx.marketBid.create({ data: { listingId, bidderId, amountCr } });
      await this.notifications.create(tx, fresh.sellerId, "AUCTION_NEW_BID", { listingId, amountCr });

      return tx.marketListing.findUniqueOrThrow({ where: { id: listingId }, include: LISTING_INCLUDE });
    });
  }

  /**
   * Settles an auction whose end time has passed: transfers the card and
   * pays the seller if there was a winning bid (the buyer isn't debited
   * again — their winning bid was already escrowed by placeBid), or just
   * releases the card back to the seller if nobody bid. Callable by any
   * authenticated player who notices an expired-but-still-ACTIVE auction,
   * mirroring the lazy-expiry pattern used for trades and duels — no cron
   * job needed. Returns null (no-op, never throws) when there's nothing
   * to settle, so a caller racing another settler never sees a spurious
   * error.
   */
  private async settleAuction(listingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: { cardInstance: { select: { cardDefinitionId: true } } },
      });
      if (!listing || listing.status !== "ACTIVE" || listing.listingType !== "AUCTION") return null;
      if (!listing.auctionEndsAt || listing.auctionEndsAt > new Date()) return null;

      const hasWinner = Boolean(listing.currentBidderId && listing.currentBidCr);
      const claim = await tx.marketListing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: hasWinner
          ? { status: "SOLD", soldAt: new Date() }
          : { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (claim.count === 0) return null;

      if (!hasWinner) {
        await tx.cardInstance.updateMany({
          where: { id: listing.cardInstanceId, state: "RESERVED_MARKET" },
          data: { state: "AVAILABLE" },
        });
        await this.notifications.create(tx, listing.sellerId, "AUCTION_ENDED_NO_BIDS", { listingId });
        return { settled: true, sold: false };
      }

      const winnerId = listing.currentBidderId!;
      const winningBidCr = listing.currentBidCr!;

      const transferResult = await tx.cardInstance.updateMany({
        where: { id: listing.cardInstanceId, ownerId: listing.sellerId, state: "RESERVED_MARKET" },
        data: { ownerId: winnerId, state: "AVAILABLE", acquiredVia: "MARKET", acquiredAt: new Date() },
      });
      if (transferResult.count !== 1) {
        throw new ConflictException("The auctioned card could not be transferred");
      }

      const feeCr = Math.floor((winningBidCr * listing.feeBps) / 10_000);
      const sellerProceeds = winningBidCr - feeCr;
      if (sellerProceeds > 0) {
        await this.wallet.credit(tx, {
          userId: listing.sellerId,
          amount: sellerProceeds,
          type: "MARKET_SALE",
          referenceType: "MarketListing",
          referenceId: listing.id,
          idempotencyKey: `auction-settle-sale-${listing.id}`,
        });
      }

      await tx.marketTransaction.create({
        data: { listingId: listing.id, buyerId: winnerId, sellerId: listing.sellerId, priceCr: winningBidCr, feeCr },
      });

      await this.missions.recordProgress(tx, listing.sellerId, "SELL_ON_MARKET", 1);
      await this.missions.recordProgress(tx, winnerId, "BUY_ON_MARKET", 1);
      await this.missions.checkSeriesCompletion(tx, winnerId, [listing.cardInstance.cardDefinitionId]);
      await this.notifications.create(tx, listing.sellerId, "MARKET_SOLD", { listingId: listing.id });
      await this.notifications.create(tx, winnerId, "AUCTION_WON", { listingId: listing.id, priceCr: winningBidCr });

      return { settled: true, sold: true };
    });
  }

  /** Public entry point: settles an auction on demand once its clock has run out. */
  async settleExpiredAuction(listingId: string) {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.listingType !== "AUCTION") throw new BadRequestException("This listing is not an auction");
    if (listing.status !== "ACTIVE") throw new ConflictException("This auction has already been settled");
    if (!listing.auctionEndsAt || listing.auctionEndsAt > new Date()) {
      throw new BadRequestException("This auction has not ended yet");
    }
    const result = await this.settleAuction(listingId);
    if (!result) throw new ConflictException("This auction was already settled by someone else");
    return this.getListingById(listingId);
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
