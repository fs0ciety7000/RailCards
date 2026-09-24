import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CollectionService } from "../collection/collection.service";
import { GradesService } from "../grades/grades.service";
import { FavoritesService } from "./favorites.service";
import { ProfileBannersService } from "../profile-banners/profile-banners.service";
import { ProfileTitlesService } from "../profile-titles/profile-titles.service";
import { MissionsService } from "../missions/missions.service";
import { DuelsService } from "../duels/duels.service";
import { levelForXp, xpToNextLevel } from "@railcards/game-domain";
import type { UpdateMeDto } from "./dto/update-me.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collection: CollectionService,
    private readonly grades: GradesService,
    private readonly favorites: FavoritesService,
    private readonly profileBanners: ProfileBannersService,
    private readonly profileTitles: ProfileTitlesService,
    private readonly missions: MissionsService,
    private readonly duels: DuelsService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, wallet: true },
    });
    return this.toDto(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const { displayName, avatarUrl, bio, isPublic } = dto;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        profile: {
          update: {
            ...(bio !== undefined ? { bio } : {}),
            ...(isPublic !== undefined ? { isPublic } : {}),
          },
        },
      },
      include: { profile: true, wallet: true },
    });
    return this.toDto(user);
  }

  /**
   * Lightweight username/display-name autocomplete for pickers like the
   * trade recipient field — active accounts only, excluding the requester
   * themselves, capped small since this is a type-ahead, not a directory.
   * A hidden profile still trades normally, so it isn't filtered out here
   * (only its detail view is gated, in getPublicProfile).
   */
  async searchUsernames(query: string, requesterId: string) {
    const q = query.trim();
    if (q.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        id: { not: requesterId },
        OR: [{ username: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }],
      },
      select: { username: true, displayName: true, avatarUrl: true },
      orderBy: { username: "asc" },
      take: 8,
    });
    return users;
  }

  /**
   * `viewerId` is who's asking: the profile owner and admins can always see
   * a profile, even when its owner has hidden it from everyone else.
   */
  async getPublicProfile(username: string, viewer: { id: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const isOwnerOrAdmin = user.id === viewer.id || viewer.role === "ADMIN";
    if (user.profile && !user.profile.isPublic && !isOwnerOrAdmin) {
      throw new ForbiddenException("Ce profil est privé");
    }

    const [uniqueCardCount, seriesCount] = await Promise.all([
      this.prisma.cardInstance.findMany({
        where: { ownerId: user.id },
        distinct: ["cardDefinitionId"],
        select: { cardDefinitionId: true },
      }),
      this.prisma.cardSeries.count(),
    ]);

    const level = levelForXp(user.profile?.xp ?? 0);
    const favoriteCards = await this.favorites.list(user.id);
    const activeBanner = await this.profileBanners.getActiveBanner(user.id);
    const activeTitle = await this.profileTitles.getActiveTitle(user.id);
    const achievements = await this.missions.listClaimedAchievements(user.id);
    const duelRecord = await this.duels.getRecord(user.id);
    return {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      bio: user.profile?.bio ?? null,
      isPublic: user.profile?.isPublic ?? true,
      level,
      grade: this.grades.gradeForLevel(level),
      memberSince: user.createdAt,
      uniqueCardCount: uniqueCardCount.length,
      totalSeriesCount: seriesCount,
      favoriteCards,
      activeBanner,
      activeTitle,
      achievements,
      duelRecord,
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

  private async toDto(user: {
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
    const favoriteCards = await this.favorites.list(user.id);
    const banners = await this.profileBanners.mine(user.id);
    const titles = await this.profileTitles.mine(user.id);
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
      grade: this.grades.gradeForLevel(progress.level),
      xpProgress: { xpIntoLevel: progress.xpIntoLevel, xpForNextLevel: progress.xpForNextLevel },
      dailyRewardStreak: user.profile?.dailyRewardStreak ?? 0,
      walletBalance: user.wallet?.balance ?? 0,
      favoriteCards,
      activeBanner: banners.active,
      unlockedBanners: banners.unlocked,
      activeTitle: titles.active,
      unlockedTitles: titles.unlocked,
    };
  }
}
