import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

function present(sleeve: { id: string; slug: string; name: string; colorFrom: string; colorTo: string; pattern: string }) {
  return { id: sleeve.id, slug: sleeve.slug, name: sleeve.name, colorFrom: sleeve.colorFrom, colorTo: sleeve.colorTo, pattern: sleeve.pattern };
}

@Injectable()
export class CardSleevesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog() {
    const sleeves = await this.prisma.cardSleeve.findMany({ orderBy: { createdAt: "asc" } });
    return sleeves.map(present);
  }

  /** Unlocked sleeves plus the currently-active one, for the viewer's own collection. */
  async mine(userId: string) {
    const [unlocks, profile] = await Promise.all([
      this.prisma.userCardSleeve.findMany({ where: { userId }, include: { sleeve: true }, orderBy: { unlockedAt: "asc" } }),
      this.prisma.userProfile.findUnique({ where: { userId }, include: { activeSleeve: true } }),
    ]);
    return {
      unlocked: unlocks.map((u) => present(u.sleeve)),
      active: profile?.activeSleeve ? present(profile.activeSleeve) : null,
    };
  }

  /** The active sleeve for any user — used by the public profile endpoint. Null if none set. */
  async getActiveSleeve(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId }, include: { activeSleeve: true } });
    return profile?.activeSleeve ? present(profile.activeSleeve) : null;
  }

  async setActive(userId: string, sleeveId: string | null) {
    if (sleeveId) {
      const unlocked = await this.prisma.userCardSleeve.findUnique({ where: { userId_sleeveId: { userId, sleeveId } } });
      if (!unlocked) throw new ForbiddenException("Pochette non débloquée");
    }
    await this.prisma.userProfile.update({ where: { userId }, data: { activeSleeveId: sleeveId } });
    return this.mine(userId);
  }

  /**
   * Unlocks `sleeveId` for `userId` inside the caller's transaction —
   * called from MissionsService.claimAchievement when the claimed
   * achievement has a rewardSleeveId set. Idempotent, mirroring
   * ProfileBannersService.unlock / ProfileTitlesService.unlock.
   */
  async unlock(tx: Tx, userId: string, sleeveId: string) {
    await tx.userCardSleeve.upsert({
      where: { userId_sleeveId: { userId, sleeveId } },
      create: { userId, sleeveId },
      update: {},
    });
    const sleeve = await tx.cardSleeve.findUniqueOrThrow({ where: { id: sleeveId } });
    return present(sleeve);
  }

  // ── Admin write operations ──────────────────────────────────────────

  async createForAdmin(data: { slug: string; name: string; colorFrom: string; colorTo: string; pattern: string }) {
    const existing = await this.prisma.cardSleeve.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException("Une pochette avec ce slug existe déjà");
    const sleeve = await this.prisma.cardSleeve.create({ data });
    return present(sleeve);
  }

  async requireExists(sleeveId: string) {
    const sleeve = await this.prisma.cardSleeve.findUnique({ where: { id: sleeveId } });
    if (!sleeve) throw new NotFoundException("Sleeve not found");
    return sleeve;
  }
}
