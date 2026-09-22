import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface GradeRow {
  minLevel: number;
  title: string;
}

/**
 * Admin-editable rank ladder (e.g. "Apprenti aiguilleur" at level 1). Keeps
 * an in-memory cache — refreshed on every admin write and at boot — so
 * `gradeForLevel` stays a synchronous lookup for every caller (auth,
 * users, missions, leaderboard) instead of needing a DB round trip on
 * every XP-bearing response.
 */
@Injectable()
export class GradesService implements OnModuleInit {
  private readonly logger = new Logger(GradesService.name);
  private cache: GradeRow[] = [{ minLevel: 1, title: "Apprenti aiguilleur" }];

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const rows = await this.prisma.grade.findMany({ orderBy: { minLevel: "asc" } });
    if (rows.length === 0) {
      this.logger.warn("No grades in the database yet — falling back to a single default rank until seeded.");
      return;
    }
    this.cache = rows.map((r) => ({ minLevel: r.minLevel, title: r.title }));
  }

  gradeForLevel(level: number): string {
    let title = this.cache[0]!.title;
    for (const grade of this.cache) {
      if (level < grade.minLevel) break;
      title = grade.title;
    }
    return title;
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listAllForAdmin() {
    return this.prisma.grade.findMany({ orderBy: { minLevel: "asc" } });
  }

  async create(data: { minLevel: number; title: string }) {
    const grade = await this.prisma.grade.create({ data });
    await this.refresh();
    return grade;
  }

  async update(id: string, data: { minLevel?: number; title?: string }) {
    const grade = await this.prisma.grade.update({ where: { id }, data });
    await this.refresh();
    return grade;
  }

  async delete(id: string) {
    const total = await this.prisma.grade.count();
    if (total <= 1) {
      throw new BadRequestException("Au moins un rang doit toujours exister");
    }
    await this.prisma.grade.delete({ where: { id } });
    await this.refresh();
  }
}
