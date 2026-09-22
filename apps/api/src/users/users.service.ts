import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CollectionService } from "../collection/collection.service";
import { gradeForLevel, levelForXp, xpToNextLevel } from "@railcards/game-domain";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collection: CollectionService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, wallet: true },
    });
    return this.toDto(user);
  }

  async getPublicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const [uniqueCardCount, seriesCount] = await Promise.all([
      this.prisma.cardInstance.findMany({
        where: { ownerId: user.id },
        distinct: ["cardDefinitionId"],
        select: { cardDefinitionId: true },
      }),
      this.prisma.cardSeries.count(),
    ]);

    const level = levelForXp(user.profile?.xp ?? 0);
    return {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      level,
      grade: gradeForLevel(level),
      memberSince: user.createdAt,
      uniqueCardCount: uniqueCardCount.length,
      totalSeriesCount: seriesCount,
    };
  }

  /**
   * A player's own cards that another player could request in a trade —
   * always AVAILABLE only (never reserved/archived ones), regardless of
   * the requester.
   */
  async getPublicCollection(username: string, page: number, pageSize: number) {
    const user = await this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user) throw new NotFoundException("User not found");

    const { items, total } = await this.collection.listInventory(user.id, { page, pageSize, state: "AVAILABLE" });
    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  private toDto(user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    status: string;
    createdAt: Date;
    profile: { xp: number; level: number; dailyRewardStreak: number } | null;
    wallet: { balance: number } | null;
  }) {
    const xp = user.profile?.xp ?? 0;
    const progress = xpToNextLevel(xp);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      xp,
      level: progress.level,
      grade: gradeForLevel(progress.level),
      xpProgress: { xpIntoLevel: progress.xpIntoLevel, xpForNextLevel: progress.xpForNextLevel },
      dailyRewardStreak: user.profile?.dailyRewardStreak ?? 0,
      walletBalance: user.wallet?.balance ?? 0,
    };
  }
}
