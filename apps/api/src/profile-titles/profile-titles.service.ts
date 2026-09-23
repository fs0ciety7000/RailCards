import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

function present(title: { id: string; slug: string; label: string }) {
  return { id: title.id, slug: title.slug, label: title.label };
}

@Injectable()
export class ProfileTitlesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog() {
    const titles = await this.prisma.profileTitle.findMany({ orderBy: { createdAt: "asc" } });
    return titles.map(present);
  }

  /** Unlocked titles plus the currently-active one, for the viewer's own profile. */
  async mine(userId: string) {
    const [unlocks, profile] = await Promise.all([
      this.prisma.userProfileTitle.findMany({ where: { userId }, include: { title: true }, orderBy: { unlockedAt: "asc" } }),
      this.prisma.userProfile.findUnique({ where: { userId }, include: { activeTitle: true } }),
    ]);
    return {
      unlocked: unlocks.map((u) => present(u.title)),
      active: profile?.activeTitle ? present(profile.activeTitle) : null,
    };
  }

  /** The active title for any user — used by the public profile endpoint. Null if none set. */
  async getActiveTitle(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId }, include: { activeTitle: true } });
    return profile?.activeTitle ? present(profile.activeTitle) : null;
  }

  async setActive(userId: string, titleId: string | null) {
    if (titleId) {
      const unlocked = await this.prisma.userProfileTitle.findUnique({ where: { userId_titleId: { userId, titleId } } });
      if (!unlocked) throw new ForbiddenException("Titre non débloqué");
    }
    await this.prisma.userProfile.update({ where: { userId }, data: { activeTitleId: titleId } });
    return this.mine(userId);
  }

  /**
   * Unlocks `titleId` for `userId` inside the caller's transaction — called
   * from MissionsService.claimAchievement when the claimed achievement has
   * a rewardTitleId set. Idempotent, mirroring ProfileBannersService.unlock.
   */
  async unlock(tx: Tx, userId: string, titleId: string) {
    await tx.userProfileTitle.upsert({
      where: { userId_titleId: { userId, titleId } },
      create: { userId, titleId },
      update: {},
    });
    const title = await tx.profileTitle.findUniqueOrThrow({ where: { id: titleId } });
    return present(title);
  }

  // ── Admin write operations ──────────────────────────────────────────

  async createForAdmin(data: { slug: string; label: string }) {
    const existing = await this.prisma.profileTitle.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException("Un titre avec ce slug existe déjà");
    const title = await this.prisma.profileTitle.create({ data });
    return present(title);
  }

  async requireExists(titleId: string) {
    const title = await this.prisma.profileTitle.findUnique({ where: { id: titleId } });
    if (!title) throw new NotFoundException("Title not found");
    return title;
  }
}
