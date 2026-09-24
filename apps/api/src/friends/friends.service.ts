import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const PUBLIC_USER_SELECT = { username: true, displayName: true, avatarUrl: true, role: true } as const;

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Accepted friendships either side of `userId`, presented as the *other* participant. */
  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: { requester: { select: PUBLIC_USER_SELECT }, addressee: { select: PUBLIC_USER_SELECT } },
      orderBy: { respondedAt: "desc" },
    });
    return rows.map((f) => ({
      friendshipId: f.id,
      friendSince: f.respondedAt,
      ...(f.requesterId === userId ? f.addressee : f.requester),
    }));
  }

  /** Usernames of `userId`'s accepted friends — the set an activity-feed friends filter checks membership against. */
  async listFriendUsernames(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true, requester: { select: { username: true } }, addressee: { select: { username: true } } },
    });
    return new Set(rows.map((f) => (f.requesterId === userId ? f.addressee.username : f.requester.username)));
  }

  /** User IDs of `userId`'s accepted friends — what a friends-scoped leaderboard ranks among. */
  async listFriendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
  }

  async listRequests(userId: string, direction: "incoming" | "outgoing") {
    const rows = await this.prisma.friendship.findMany({
      where: direction === "incoming" ? { addresseeId: userId, status: "PENDING" } : { requesterId: userId, status: "PENDING" },
      include: { requester: { select: PUBLIC_USER_SELECT }, addressee: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((f) => ({
      id: f.id,
      createdAt: f.createdAt,
      user: direction === "incoming" ? f.requester : f.addressee,
    }));
  }

  async sendRequest(requesterId: string, targetUsername: string) {
    const addressee = await this.prisma.user.findUnique({ where: { username: targetUsername.toLowerCase() } });
    if (!addressee) throw new NotFoundException("Player not found");
    if (addressee.id === requesterId) throw new BadRequestException("You cannot friend yourself");

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: addressee.id },
          { requesterId: addressee.id, addresseeId: requesterId },
        ],
      },
    });
    if (existing) {
      throw new ConflictException(existing.status === "ACCEPTED" ? "You are already friends" : "A friend request is already pending between you");
    }

    return this.prisma.$transaction(async (tx) => {
      const friendship = await tx.friendship.create({
        data: { requesterId, addresseeId: addressee.id },
        include: { requester: { select: PUBLIC_USER_SELECT } },
      });
      await this.notifications.create(tx, addressee.id, "FRIEND_REQUEST_RECEIVED", {
        friendshipId: friendship.id,
        username: friendship.requester.username,
        displayName: friendship.requester.displayName,
      });
      return friendship;
    });
  }

  async acceptRequest(userId: string, friendshipId: string) {
    return this.prisma.$transaction(async (tx) => {
      const friendship = await tx.friendship.findUnique({ where: { id: friendshipId }, include: { addressee: { select: PUBLIC_USER_SELECT } } });
      if (!friendship) throw new NotFoundException("Friend request not found");
      if (friendship.addresseeId !== userId) throw new ForbiddenException("Only the recipient can accept this request");
      if (friendship.status !== "PENDING") throw new ConflictException("This request is no longer pending");

      const updated = await tx.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      await this.notifications.create(tx, friendship.requesterId, "FRIEND_REQUEST_ACCEPTED", {
        friendshipId,
        username: friendship.addressee.username,
        displayName: friendship.addressee.displayName,
      });
      return updated;
    });
  }

  /**
   * Deletes a PENDING request — from the addressee this is a decline (the
   * requester is notified), from the requester this is a cancel (silent,
   * it was their own action).
   */
  async declineOrCancelRequest(userId: string, friendshipId: string) {
    return this.prisma.$transaction(async (tx) => {
      const friendship = await tx.friendship.findUnique({ where: { id: friendshipId }, include: { addressee: { select: PUBLIC_USER_SELECT } } });
      if (!friendship) throw new NotFoundException("Friend request not found");
      if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
        throw new ForbiddenException("You are not a participant in this request");
      }
      if (friendship.status !== "PENDING") throw new ConflictException("This request is no longer pending");

      await tx.friendship.delete({ where: { id: friendshipId } });
      if (friendship.addresseeId === userId) {
        await this.notifications.create(tx, friendship.requesterId, "FRIEND_REQUEST_DECLINED", {
          username: friendship.addressee.username,
          displayName: friendship.addressee.displayName,
        });
      }
      return { removed: true };
    });
  }

  /** Removes an ACCEPTED friendship — either side, silently (no notification, same as most apps' unfriend). */
  async removeFriend(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) throw new NotFoundException("Friendship not found");
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      throw new ForbiddenException("You are not a participant in this friendship");
    }
    if (friendship.status !== "ACCEPTED") throw new ConflictException("You are not friends");
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { removed: true };
  }
}
