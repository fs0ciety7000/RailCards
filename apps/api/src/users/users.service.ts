import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { levelForXp } from "@railcards/game-domain";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      level: levelForXp(user.profile?.xp ?? 0),
      memberSince: user.createdAt,
      uniqueCardCount: uniqueCardCount.length,
      totalSeriesCount: seriesCount,
    };
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
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      xp: user.profile?.xp ?? 0,
      level: levelForXp(user.profile?.xp ?? 0),
      dailyRewardStreak: user.profile?.dailyRewardStreak ?? 0,
      walletBalance: user.wallet?.balance ?? 0,
    };
  }
}
