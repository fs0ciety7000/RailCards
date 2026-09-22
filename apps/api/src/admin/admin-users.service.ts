import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MissionsService } from "../missions/missions.service";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
    private readonly missions: MissionsService,
  ) {}

  async list(search: string | undefined, page: number, pageSize: number) {
    const where = search
      ? { OR: [{ username: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          wallet: { select: { balance: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(({ wallet, ...u }) => ({ ...u, balance: wallet?.balance ?? 0 })),
      total,
    };
  }

  async suspend(targetUserId: string, actingAdminId: string) {
    if (targetUserId === actingAdminId) throw new BadRequestException("You cannot suspend your own account");
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");
    // Revoking sessions on suspension prevents a currently-logged-in user
    // from continuing to use a live access token after being suspended
    // (the access token itself remains valid until it expires, but every
    // refresh and every fresh login is blocked).
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: targetUserId }, data: { status: "SUSPENDED" } });
      await tx.session.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
  }

  async reactivate(targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");
    return this.prisma.user.update({ where: { id: targetUserId }, data: { status: "ACTIVE" } });
  }

  async adjustWallet(targetUserId: string, amount: number, reason: string | undefined) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");

    const entry = await this.prisma.$transaction(async (tx) => {
      if (amount > 0) {
        const result = await this.wallet.credit(tx, {
          userId: targetUserId,
          amount,
          type: "ADMIN_ADJUSTMENT",
          referenceType: "admin-wallet-adjustment",
          metadata: reason ? { reason } : undefined,
        });
        await this.notifications.create(tx, targetUserId, "CREDITS_EARNED", { amount, reason });
        return result;
      }
      return this.wallet.debit(tx, {
        userId: targetUserId,
        amount: -amount,
        type: "ADMIN_ADJUSTMENT",
        referenceType: "admin-wallet-adjustment",
        metadata: reason ? { reason } : undefined,
      });
    });

    return { balance: entry.balanceAfter };
  }

  /**
   * Deletes every CardInstance currently owned by `userId`, plus whatever
   * historical rows would otherwise block that (trade items, market
   * listings/transactions, booster pulls) — regardless of which other
   * users those historical rows belong to, since a traded-away card's old
   * trade/listing history still points at the instance by id. Shared by
   * `deleteUser` (as part of the full cascade) and `resetCards` (which
   * only wipes the collection, keeping the account itself).
   */
  private async purgeCardInstances(tx: Prisma.TransactionClient, userId: string): Promise<number> {
    const owned = await tx.cardInstance.findMany({ where: { ownerId: userId }, select: { id: true } });
    const ownedIds = owned.map((i) => i.id);

    const listingWhere: Prisma.MarketListingWhereInput = {
      OR: [{ sellerId: userId }, { cardInstanceId: { in: ownedIds } }],
    };
    await tx.marketTransaction.deleteMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }, { listing: listingWhere }] },
    });
    await tx.marketListing.deleteMany({ where: listingWhere });

    await tx.tradeItem.deleteMany({ where: { cardInstanceId: { in: ownedIds } } });
    await tx.trade.deleteMany({ where: { OR: [{ initiatorId: userId }, { recipientId: userId }] } });

    await tx.boosterPull.deleteMany({ where: { cardInstanceId: { in: ownedIds } } });
    await tx.cardInstance.deleteMany({ where: { id: { in: ownedIds } } });

    return ownedIds.length;
  }

  /** Wipes a player's entire collection (and the trade/market/booster history tied to it) without touching the account itself. */
  async resetCards(targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");

    const instancesRemoved = await this.prisma.$transaction((tx) => this.purgeCardInstances(tx, targetUserId));
    return { instancesRemoved };
  }

  /** Creates `quantity` new instances of `cardDefinitionId` for `targetUserId`, as an admin grant, and notifies the player. */
  async grantCard(targetUserId: string, cardDefinitionId: string, quantity: number) {
    const [user, card] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetUserId } }),
      this.prisma.cardDefinition.findUnique({ where: { id: cardDefinitionId } }),
    ]);
    if (!user) throw new NotFoundException("User not found");
    if (!card) throw new NotFoundException("Card not found");

    return this.prisma.$transaction(async (tx) => {
      const instanceIds: string[] = [];
      for (let i = 0; i < quantity; i++) {
        const priorCount = await tx.cardInstance.count({ where: { cardDefinitionId } });
        const instance = await tx.cardInstance.create({
          data: { cardDefinitionId, ownerId: targetUserId, serialNumber: priorCount + 1, acquiredVia: "ADMIN_GRANT" },
        });
        instanceIds.push(instance.id);
      }
      await this.missions.checkSeriesCompletion(tx, targetUserId, [cardDefinitionId]);
      await this.notifications.create(tx, targetUserId, "SYSTEM", {
        message:
          quantity === 1
            ? `Un administrateur vous a offert la carte "${card.name}".`
            : `Un administrateur vous a offert ${quantity} exemplaires de la carte "${card.name}".`,
        cardDefinitionId,
        quantity,
      });
      return { granted: instanceIds.length, cardDefinitionId, instanceIds };
    });
  }

  /**
   * Permanently deletes an account and everything tied to it: collection,
   * trades, market activity, missions/achievements progress, wallet,
   * sessions, notifications. Cascades and SET NULLs declared in the schema
   * handle UserProfile/Session/PasswordResetToken/FavoriteCard and
   * Invitation/AuditLog references automatically; everything else (marked
   * RESTRICT because it must never silently vanish in the ordinary course
   * of the app) is deleted explicitly here, in FK-safe order.
   */
  async deleteUser(targetUserId: string, actingAdminId: string) {
    if (targetUserId === actingAdminId) throw new BadRequestException("You cannot delete your own account");
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");

    if (user.role === "ADMIN") {
      const otherAdmins = await this.prisma.user.count({ where: { role: "ADMIN", id: { not: targetUserId } } });
      if (otherAdmins === 0) {
        throw new ConflictException("Cannot delete the last remaining admin account");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await this.purgeCardInstances(tx, targetUserId);
      await tx.boosterOpening.deleteMany({ where: { userId: targetUserId } });
      await tx.userMission.deleteMany({ where: { userId: targetUserId } });
      await tx.userAchievement.deleteMany({ where: { userId: targetUserId } });
      await tx.userSeriesCompletion.deleteMany({ where: { userId: targetUserId } });
      await tx.dailyRewardClaim.deleteMany({ where: { userId: targetUserId } });
      await tx.notification.deleteMany({ where: { userId: targetUserId } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: targetUserId }, { targetUserId }] } });

      const wallet = await tx.wallet.findUnique({ where: { userId: targetUserId } });
      if (wallet) {
        await tx.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
        await tx.wallet.delete({ where: { id: wallet.id } });
      }

      await tx.user.delete({ where: { id: targetUserId } });
    });

    return { deleted: true };
  }
}
