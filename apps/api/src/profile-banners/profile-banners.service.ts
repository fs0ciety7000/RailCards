import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

function present(banner: { id: string; slug: string; name: string; colorFrom: string; colorTo: string; icon: string }) {
  return { id: banner.id, slug: banner.slug, name: banner.name, colorFrom: banner.colorFrom, colorTo: banner.colorTo, icon: banner.icon };
}

@Injectable()
export class ProfileBannersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog() {
    const banners = await this.prisma.profileBanner.findMany({ orderBy: { createdAt: "asc" } });
    return banners.map(present);
  }

  /** Unlocked banners plus the currently-active one, for the viewer's own profile. */
  async mine(userId: string) {
    const [unlocks, profile] = await Promise.all([
      this.prisma.userProfileBanner.findMany({ where: { userId }, include: { banner: true }, orderBy: { unlockedAt: "asc" } }),
      this.prisma.userProfile.findUnique({ where: { userId }, include: { activeBanner: true } }),
    ]);
    return {
      unlocked: unlocks.map((u) => present(u.banner)),
      active: profile?.activeBanner ? present(profile.activeBanner) : null,
    };
  }

  /** The active banner for any user — used by the public profile endpoint. Null if none set. */
  async getActiveBanner(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId }, include: { activeBanner: true } });
    return profile?.activeBanner ? present(profile.activeBanner) : null;
  }

  async setActive(userId: string, bannerId: string | null) {
    if (bannerId) {
      const unlocked = await this.prisma.userProfileBanner.findUnique({ where: { userId_bannerId: { userId, bannerId } } });
      if (!unlocked) throw new ForbiddenException("Bannière non débloquée");
    }
    await this.prisma.userProfile.update({ where: { userId }, data: { activeBannerId: bannerId } });
    return this.mine(userId);
  }

  /**
   * Unlocks `bannerId` for `userId` inside the caller's transaction —
   * called from MissionsService.claimAchievement when the claimed
   * achievement has a rewardBannerId set. Idempotent: claiming twice (which
   * shouldn't happen, but nothing else here assumes it can't) never errors.
   */
  async unlock(tx: Tx, userId: string, bannerId: string) {
    await tx.userProfileBanner.upsert({
      where: { userId_bannerId: { userId, bannerId } },
      create: { userId, bannerId },
      update: {},
    });
    const banner = await tx.profileBanner.findUniqueOrThrow({ where: { id: bannerId } });
    return present(banner);
  }

  // ── Admin write operations ──────────────────────────────────────────

  async createForAdmin(data: { slug: string; name: string; colorFrom: string; colorTo: string; icon: string }) {
    const existing = await this.prisma.profileBanner.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException("Une bannière avec ce slug existe déjà");
    const banner = await this.prisma.profileBanner.create({ data });
    return present(banner);
  }

  async requireExists(bannerId: string) {
    const banner = await this.prisma.profileBanner.findUnique({ where: { id: bannerId } });
    if (!banner) throw new NotFoundException("Banner not found");
    return banner;
  }
}
