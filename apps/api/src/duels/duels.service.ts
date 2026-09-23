import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DuelStat, Prisma } from "@railcards/database";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { NotificationsService } from "../notifications/notifications.service";

type Tx = Prisma.TransactionClient;

const DUEL_STATS: DuelStat[] = ["POWER", "RELIABILITY", "CHARM"];

interface CombatStats {
  power: number;
  reliability: number;
  charm: number;
}

function statKey(stat: DuelStat): keyof CombatStats {
  return stat === "POWER" ? "power" : stat === "RELIABILITY" ? "reliability" : "charm";
}

function parseCombatStats(value: Prisma.JsonValue | null): CombatStats | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.power !== "number" || typeof v.reliability !== "number" || typeof v.charm !== "number") return null;
  return { power: v.power, reliability: v.reliability, charm: v.charm };
}

const DUEL_INCLUDE = {
  challenger: { select: { username: true, displayName: true } },
  opponent: { select: { username: true, displayName: true } },
  winner: { select: { username: true, displayName: true } },
  challengerCardInstance: { include: { cardDefinition: { include: { rarity: true, series: true } } } },
  opponentCardInstance: { include: { cardDefinition: { include: { rarity: true, series: true } } } },
} satisfies Prisma.DuelInclude;

@Injectable()
export class DuelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Loads a card the caller must own, with combat stats enabled and the card AVAILABLE. */
  private async loadStakeCard(tx: Tx, ownerId: string, cardInstanceId: string) {
    const instance = await tx.cardInstance.findUnique({
      where: { id: cardInstanceId },
      include: { cardDefinition: true },
    });
    if (!instance) throw new NotFoundException("Card not found");
    if (instance.ownerId !== ownerId) throw new BadRequestException("You can only duel with a card you own");
    if (instance.state !== "AVAILABLE") throw new BadRequestException("This card is reserved and cannot be used in a duel");
    if (!instance.cardDefinition.combatStatsEnabled) {
      throw new BadRequestException("This card has no combat stats and cannot be used in a duel");
    }
    return instance;
  }

  async create(challengerId: string, params: { opponentUsername: string; cardInstanceId: string; wagerCr: number; message?: string }) {
    const opponent = await this.prisma.user.findUnique({ where: { username: params.opponentUsername.toLowerCase() } });
    if (!opponent) throw new NotFoundException("Opponent not found");
    if (opponent.id === challengerId) throw new BadRequestException("You cannot duel yourself");

    return this.prisma.$transaction(async (tx) => {
      await this.loadStakeCard(tx, challengerId, params.cardInstanceId);

      const wallet = await this.wallet.getOrCreateWallet(tx, challengerId);
      if (wallet.balance < params.wagerCr) {
        throw new BadRequestException("You do not have enough CR to cover this wager");
      }

      const duel = await tx.duel.create({
        data: {
          challengerId,
          challengerCardInstanceId: params.cardInstanceId,
          opponentId: opponent.id,
          wagerCr: params.wagerCr,
          message: params.message,
          expiresAt: new Date(Date.now() + GAME_CONSTANTS.DUEL_EXPIRY_HOURS * 3_600_000),
        },
        include: DUEL_INCLUDE,
      });

      await this.notifications.create(tx, opponent.id, "DUEL_RECEIVED", { duelId: duel.id, wagerCr: params.wagerCr });
      return duel;
    });
  }

  async list(userId: string, direction: "sent" | "received" | "all" = "all", status?: string) {
    const where =
      direction === "sent"
        ? { challengerId: userId }
        : direction === "received"
          ? { opponentId: userId }
          : { OR: [{ challengerId: userId }, { opponentId: userId }] };

    return this.prisma.duel.findMany({
      where: { ...where, status: status as never },
      include: DUEL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(userId: string, duelId: string) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId }, include: DUEL_INCLUDE });
    if (!duel) throw new NotFoundException("Duel not found");
    if (duel.challengerId !== userId && duel.opponentId !== userId) {
      throw new ForbiddenException("You are not a participant in this duel");
    }
    return duel;
  }

  /**
   * Resolves the duel: both wagers are debited only now (never at
   * creation, so an ignored challenge never leaves anyone's CR stuck),
   * a stat is picked at random, and whoever's card scores higher on it
   * wins the pot. A tie moves no CR at all.
   *
   * Prisma rolls an interactive transaction back entirely if its callback
   * throws, so a "write a terminal status, then throw to report the
   * error" sequence would silently lose that write. Terminal transitions
   * that also need to report an error (expired, or the challenger can no
   * longer honor the duel) are therefore committed in their own
   * throw-free transaction first, and the error is thrown only after
   * that commit succeeds. Pre-flight checks that never need to mutate
   * anything run before any transaction, so a failed pre-flight leaves
   * the duel untouched (still PENDING) for a retry.
   */
  async accept(opponentId: string, duelId: string, opponentCardInstanceId: string) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new NotFoundException("Duel not found");
    if (duel.opponentId !== opponentId) throw new ForbiddenException("Only the challenged player can accept this duel");
    if (duel.status !== "PENDING") throw new ConflictException("This duel is no longer pending");

    if (duel.expiresAt < new Date()) {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.duel.updateMany({ where: { id: duel.id, status: "PENDING" }, data: { status: "EXPIRED" } });
        if (claim.count > 0) {
          await this.notifications.create(tx, duel.challengerId, "DUEL_EXPIRED", { duelId: duel.id });
        }
      });
      throw new BadRequestException("This duel challenge has expired");
    }

    const opponentCard = await this.prisma.cardInstance.findUnique({
      where: { id: opponentCardInstanceId },
      include: { cardDefinition: true },
    });
    if (!opponentCard) throw new NotFoundException("Card not found");
    if (opponentCard.ownerId !== opponentId) throw new BadRequestException("You can only duel with a card you own");
    if (opponentCard.state !== "AVAILABLE") throw new BadRequestException("This card is reserved and cannot be used in a duel");
    if (!opponentCard.cardDefinition.combatStatsEnabled) {
      throw new BadRequestException("This card has no combat stats and cannot be used in a duel");
    }
    const opponentBalance = (await this.prisma.wallet.findUnique({ where: { userId: opponentId } }))?.balance ?? 0;
    if (opponentBalance < duel.wagerCr) throw new BadRequestException("You do not have enough CR to cover this wager");

    // The challenger's stake card and balance must still hold up — either
    // could have changed since the challenge was issued (card sold/traded/
    // crafted away, or CR spent elsewhere).
    const challengerCard = await this.prisma.cardInstance.findUnique({
      where: { id: duel.challengerCardInstanceId },
      include: { cardDefinition: true },
    });
    const challengerCardValid =
      challengerCard &&
      challengerCard.ownerId === duel.challengerId &&
      challengerCard.state === "AVAILABLE" &&
      challengerCard.cardDefinition.combatStatsEnabled;
    const challengerBalance = (await this.prisma.wallet.findUnique({ where: { userId: duel.challengerId } }))?.balance ?? 0;

    if (!challengerCardValid || challengerBalance < duel.wagerCr) {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.duel.updateMany({
          where: { id: duel.id, status: "PENDING" },
          data: { status: "CANCELLED", respondedAt: new Date() },
        });
        if (claim.count > 0) {
          await this.notifications.create(tx, duel.challengerId, "DUEL_CANCELLED", {
            duelId: duel.id,
            reason: challengerCardValid ? "insufficient funds" : "stake card no longer available",
          });
        }
      });
      throw new ConflictException("The challenger can no longer honor this duel; it has been cancelled");
    }

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.duel.updateMany({ where: { id: duel.id, status: "PENDING" }, data: { status: "ACCEPTED" } });
      if (claim.count === 0) throw new ConflictException("This duel is no longer pending");

      // Re-read fresh inside the transaction: the pre-flight checks above
      // ran outside any lock, so re-verify nothing changed in the gap.
      const freshOpponentCard = await tx.cardInstance.findUnique({ where: { id: opponentCardInstanceId } });
      if (!freshOpponentCard || freshOpponentCard.ownerId !== opponentId || freshOpponentCard.state !== "AVAILABLE") {
        throw new ConflictException("Your selected card is no longer available");
      }
      const freshChallengerCard = await tx.cardInstance.findUnique({ where: { id: duel.challengerCardInstanceId } });
      if (!freshChallengerCard || freshChallengerCard.ownerId !== duel.challengerId || freshChallengerCard.state !== "AVAILABLE") {
        throw new ConflictException("The challenger's card is no longer available");
      }

      const stat = DUEL_STATS[Math.floor(Math.random() * DUEL_STATS.length)]!;
      const key = statKey(stat);
      const challengerStats = parseCombatStats(challengerCard!.cardDefinition.combatStats);
      const opponentStats = parseCombatStats(opponentCard.cardDefinition.combatStats);
      const challengerValue = challengerStats?.[key] ?? 0;
      const opponentValue = opponentStats?.[key] ?? 0;

      const winnerId = challengerValue === opponentValue ? null : challengerValue > opponentValue ? duel.challengerId : opponentId;

      if (winnerId) {
        await this.wallet.debit(tx, {
          userId: duel.challengerId,
          amount: duel.wagerCr,
          type: "DUEL_WAGER",
          referenceType: "Duel",
          referenceId: duel.id,
          idempotencyKey: `duel-${duel.id}-challenger-wager`,
        });
        await this.wallet.debit(tx, {
          userId: opponentId,
          amount: duel.wagerCr,
          type: "DUEL_WAGER",
          referenceType: "Duel",
          referenceId: duel.id,
          idempotencyKey: `duel-${duel.id}-opponent-wager`,
        });
        await this.wallet.credit(tx, {
          userId: winnerId,
          amount: duel.wagerCr * 2,
          type: "DUEL_PAYOUT",
          referenceType: "Duel",
          referenceId: duel.id,
          idempotencyKey: `duel-${duel.id}-payout`,
        });
      }
      // A tie moves no CR at all — nothing to debit or refund.

      const resolved = await tx.duel.update({
        where: { id: duel.id },
        data: {
          opponentCardInstanceId,
          stat,
          challengerValue,
          opponentValue,
          winnerId,
          respondedAt: new Date(),
        },
        include: DUEL_INCLUDE,
      });

      const payload = { duelId: duel.id, stat, challengerValue, opponentValue, winnerId, wagerCr: duel.wagerCr };
      await this.notifications.create(tx, duel.challengerId, "DUEL_RESOLVED", payload);
      await this.notifications.create(tx, opponentId, "DUEL_RESOLVED", payload);

      return resolved;
    });
  }

  async decline(opponentId: string, duelId: string) {
    return this.prisma.$transaction(async (tx) => {
      const duel = await tx.duel.findUnique({ where: { id: duelId } });
      if (!duel) throw new NotFoundException("Duel not found");
      if (duel.opponentId !== opponentId) throw new ForbiddenException("Only the challenged player can decline this duel");

      const result = await tx.duel.updateMany({
        where: { id: duel.id, status: "PENDING" },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
      if (result.count === 0) throw new ConflictException("This duel is no longer pending");

      await this.notifications.create(tx, duel.challengerId, "DUEL_DECLINED", { duelId: duel.id });
      return { declined: true };
    });
  }

  async cancel(challengerId: string, duelId: string) {
    return this.prisma.$transaction(async (tx) => {
      const duel = await tx.duel.findUnique({ where: { id: duelId } });
      if (!duel) throw new NotFoundException("Duel not found");
      if (duel.challengerId !== challengerId) throw new ForbiddenException("Only the challenger can cancel this duel");

      const result = await tx.duel.updateMany({
        where: { id: duel.id, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      if (result.count === 0) throw new ConflictException("This duel is no longer pending");

      await this.notifications.create(tx, duel.opponentId, "DUEL_CANCELLED", { duelId: duel.id, reason: "cancelled by challenger" });
      return { cancelled: true };
    });
  }
}
