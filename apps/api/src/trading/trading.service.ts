import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { MissionsService } from "../missions/missions.service";
import { NotificationsService } from "../notifications/notifications.service";

type Tx = Prisma.TransactionClient;

export interface CreateTradeParams {
  initiatorId: string;
  recipientUsername: string;
  offeredCardInstanceIds: string[];
  requestedCardInstanceIds: string[];
  initiatorCr?: number;
  recipientCr?: number;
  message?: string;
  expiresInHours?: number;
}

export interface CounterTradeParams {
  counterUserId: string;
  originalTradeId: string;
  offeredCardInstanceIds: string[];
  requestedCardInstanceIds: string[];
  initiatorCr?: number;
  recipientCr?: number;
  message?: string;
  expiresInHours?: number;
}

interface TradeRowParams {
  initiatorId: string;
  recipientId: string;
  offeredCardInstanceIds: string[];
  requestedCardInstanceIds: string[];
  initiatorCr?: number;
  recipientCr?: number;
  message?: string;
  expiresInHours?: number;
  parentTradeId?: string;
}

@Injectable()
export class TradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly missions: MissionsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Reserves the initiator's offered cards for a trade row about to be created. */
  private async reserveOfferedItems(tx: Tx, ownerId: string, cardInstanceIds: string[]) {
    if (cardInstanceIds.length === 0) return;
    const result = await tx.cardInstance.updateMany({
      where: { id: { in: cardInstanceIds }, ownerId, state: "AVAILABLE" },
      data: { state: "RESERVED_TRADE" },
    });
    if (result.count !== cardInstanceIds.length) {
      throw new ConflictException("One or more offered cards are not available to trade");
    }
  }

  /** Shared by create() and counter(): reserves cards and inserts the Trade + TradeItem rows. */
  private async createTradeRow(tx: Tx, params: TradeRowParams) {
    await this.reserveOfferedItems(tx, params.initiatorId, params.offeredCardInstanceIds);

    const expiresAt = new Date(
      Date.now() + (params.expiresInHours ?? GAME_CONSTANTS.TRADE_DEFAULT_EXPIRY_HOURS) * 3_600_000,
    );

    return tx.trade.create({
      data: {
        initiatorId: params.initiatorId,
        recipientId: params.recipientId,
        initiatorCr: params.initiatorCr ?? 0,
        recipientCr: params.recipientCr ?? 0,
        message: params.message,
        expiresAt,
        parentTradeId: params.parentTradeId,
        items: {
          create: [
            ...params.offeredCardInstanceIds.map((id) => ({ cardInstanceId: id, side: "INITIATOR" as const })),
            ...params.requestedCardInstanceIds.map((id) => ({ cardInstanceId: id, side: "RECIPIENT" as const })),
          ],
        },
      },
      include: { items: { include: { cardInstance: { include: { cardDefinition: true } } } } },
    });
  }

  async create(params: CreateTradeParams) {
    if (params.offeredCardInstanceIds.length === 0 && params.requestedCardInstanceIds.length === 0) {
      throw new BadRequestException("A trade must include at least one card");
    }

    const recipient = await this.prisma.user.findUnique({ where: { username: params.recipientUsername.toLowerCase() } });
    if (!recipient) throw new NotFoundException("Recipient not found");
    if (recipient.id === params.initiatorId) throw new BadRequestException("You cannot trade with yourself");

    return this.prisma.$transaction(async (tx) => {
      const trade = await this.createTradeRow(tx, { ...params, recipientId: recipient.id });
      await this.notifications.create(tx, recipient.id, "TRADE_RECEIVED", { tradeId: trade.id });
      return trade;
    });
  }

  /**
   * The recipient of a PENDING trade proposes different terms instead:
   * the original trade is closed as COUNTERED (its initiator's items
   * released, exactly like a rejection) and a brand new trade is opened
   * in the opposite direction, linked back via parentTradeId. The
   * original initiator gets a TRADE_COUNTERED notification and responds
   * to the new trade exactly like any other proposal (accept/reject/
   * counter again).
   */
  async counter(params: CounterTradeParams) {
    if (params.offeredCardInstanceIds.length === 0 && params.requestedCardInstanceIds.length === 0) {
      throw new BadRequestException("A trade must include at least one card");
    }

    return this.prisma.$transaction(async (tx) => {
      const original = await tx.trade.findUnique({ where: { id: params.originalTradeId } });
      if (!original) throw new NotFoundException("Trade not found");
      if (original.recipientId !== params.counterUserId) {
        throw new ForbiddenException("Only the recipient can counter this trade");
      }

      if (original.status === "PENDING" && original.expiresAt < new Date()) {
        await tx.trade.update({ where: { id: original.id }, data: { status: "EXPIRED" } });
        await this.releaseInitiatorItems(tx, original.id);
        throw new BadRequestException("This trade offer has expired");
      }

      const closed = await tx.trade.updateMany({
        where: { id: original.id, status: "PENDING" },
        data: { status: "COUNTERED", respondedAt: new Date() },
      });
      if (closed.count === 0) throw new ConflictException("This trade is no longer pending");

      await this.releaseInitiatorItems(tx, original.id);

      const counterTrade = await this.createTradeRow(tx, {
        initiatorId: params.counterUserId,
        recipientId: original.initiatorId,
        offeredCardInstanceIds: params.offeredCardInstanceIds,
        requestedCardInstanceIds: params.requestedCardInstanceIds,
        initiatorCr: params.initiatorCr,
        recipientCr: params.recipientCr,
        message: params.message,
        expiresInHours: params.expiresInHours,
        parentTradeId: original.id,
      });

      await this.notifications.create(tx, original.initiatorId, "TRADE_COUNTERED", {
        tradeId: counterTrade.id,
        originalTradeId: original.id,
      });

      return counterTrade;
    });
  }

  async list(userId: string, direction: "sent" | "received" | "all", status?: string) {
    const where =
      direction === "sent"
        ? { initiatorId: userId }
        : direction === "received"
          ? { recipientId: userId }
          : { OR: [{ initiatorId: userId }, { recipientId: userId }] };

    return this.prisma.trade.findMany({
      where: { ...where, status: status as never },
      include: {
        initiator: { select: { username: true, displayName: true } },
        recipient: { select: { username: true, displayName: true } },
        items: { include: { cardInstance: { include: { cardDefinition: { include: { rarity: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(userId: string, tradeId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        initiator: { select: { username: true, displayName: true } },
        recipient: { select: { username: true, displayName: true } },
        items: { include: { cardInstance: { include: { cardDefinition: { include: { rarity: true } } } } } },
      },
    });
    if (!trade) throw new NotFoundException("Trade not found");
    if (trade.initiatorId !== userId && trade.recipientId !== userId) {
      throw new ForbiddenException("You are not a participant in this trade");
    }
    return trade;
  }

  private async releaseInitiatorItems(tx: Tx, tradeId: string) {
    const items = await tx.tradeItem.findMany({ where: { tradeId, side: "INITIATOR" } });
    if (items.length > 0) {
      await tx.cardInstance.updateMany({
        where: { id: { in: items.map((i) => i.cardInstanceId) }, state: "RESERVED_TRADE" },
        data: { state: "AVAILABLE" },
      });
    }
  }

  async accept(recipientId: string, tradeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findUnique({ where: { id: tradeId }, include: { items: true } });
      if (!trade) throw new NotFoundException("Trade not found");
      if (trade.recipientId !== recipientId) throw new ForbiddenException("Only the recipient can accept this trade");

      if (trade.status === "PENDING" && trade.expiresAt < new Date()) {
        await tx.trade.update({ where: { id: trade.id }, data: { status: "EXPIRED" } });
        await this.releaseInitiatorItems(tx, trade.id);
        throw new BadRequestException("This trade offer has expired");
      }

      const claim = await tx.trade.updateMany({
        where: { id: trade.id, status: "PENDING" },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      if (claim.count === 0) throw new ConflictException("This trade is no longer pending");

      const initiatorItems = trade.items.filter((i) => i.side === "INITIATOR");
      const recipientItems = trade.items.filter((i) => i.side === "RECIPIENT");

      for (const item of initiatorItems) {
        const result = await tx.cardInstance.updateMany({
          where: { id: item.cardInstanceId, ownerId: trade.initiatorId, state: "RESERVED_TRADE" },
          data: { ownerId: trade.recipientId, state: "AVAILABLE", acquiredVia: "TRADE", acquiredAt: new Date() },
        });
        if (result.count !== 1) {
          throw new ConflictException("An offered card is no longer available; the trade could not be completed");
        }
      }

      for (const item of recipientItems) {
        const result = await tx.cardInstance.updateMany({
          where: { id: item.cardInstanceId, ownerId: trade.recipientId, state: "AVAILABLE" },
          data: { ownerId: trade.initiatorId, state: "AVAILABLE", acquiredVia: "TRADE", acquiredAt: new Date() },
        });
        if (result.count !== 1) {
          throw new ConflictException(
            "A requested card no longer belongs to the recipient; the trade could not be completed",
          );
        }
      }

      if (trade.initiatorCr > 0) {
        await this.wallet.debit(tx, {
          userId: trade.initiatorId,
          amount: trade.initiatorCr,
          type: "TRADE_CR_TRANSFER",
          referenceType: "Trade",
          referenceId: trade.id,
          idempotencyKey: `trade-${trade.id}-initiator-debit`,
        });
        await this.wallet.credit(tx, {
          userId: trade.recipientId,
          amount: trade.initiatorCr,
          type: "TRADE_CR_TRANSFER",
          referenceType: "Trade",
          referenceId: trade.id,
          idempotencyKey: `trade-${trade.id}-recipient-credit`,
        });
      }
      if (trade.recipientCr > 0) {
        await this.wallet.debit(tx, {
          userId: trade.recipientId,
          amount: trade.recipientCr,
          type: "TRADE_CR_TRANSFER",
          referenceType: "Trade",
          referenceId: trade.id,
          idempotencyKey: `trade-${trade.id}-recipient-debit`,
        });
        await this.wallet.credit(tx, {
          userId: trade.initiatorId,
          amount: trade.recipientCr,
          type: "TRADE_CR_TRANSFER",
          referenceType: "Trade",
          referenceId: trade.id,
          idempotencyKey: `trade-${trade.id}-initiator-credit`,
        });
      }

      await this.missions.recordProgress(tx, trade.initiatorId, "COMPLETE_TRADE", 1);
      await this.missions.recordProgress(tx, trade.recipientId, "COMPLETE_TRADE", 1);
      await this.notifications.create(tx, trade.initiatorId, "TRADE_ACCEPTED", { tradeId: trade.id });

      return tx.trade.findUniqueOrThrow({ where: { id: trade.id }, include: { items: true } });
    });
  }

  async reject(recipientId: string, tradeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findUnique({ where: { id: tradeId } });
      if (!trade) throw new NotFoundException("Trade not found");
      if (trade.recipientId !== recipientId) throw new ForbiddenException("Only the recipient can reject this trade");

      const result = await tx.trade.updateMany({
        where: { id: trade.id, status: "PENDING" },
        data: { status: "REJECTED", respondedAt: new Date() },
      });
      if (result.count === 0) throw new ConflictException("This trade is no longer pending");

      await this.releaseInitiatorItems(tx, trade.id);
      await this.notifications.create(tx, trade.initiatorId, "TRADE_REJECTED", { tradeId: trade.id });
      return tx.trade.findUniqueOrThrow({ where: { id: trade.id } });
    });
  }

  async cancel(initiatorId: string, tradeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findUnique({ where: { id: tradeId } });
      if (!trade) throw new NotFoundException("Trade not found");
      if (trade.initiatorId !== initiatorId) throw new ForbiddenException("Only the initiator can cancel this trade");

      const result = await tx.trade.updateMany({
        where: { id: trade.id, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      if (result.count === 0) throw new ConflictException("This trade is no longer pending");

      await this.releaseInitiatorItems(tx, trade.id);
      await this.notifications.create(tx, trade.recipientId, "TRADE_CANCELLED", { tradeId: trade.id });
      return tx.trade.findUniqueOrThrow({ where: { id: trade.id } });
    });
  }
}
