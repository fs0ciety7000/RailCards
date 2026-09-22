import { Injectable } from "@nestjs/common";
import { Prisma } from "@railcards/database";
import { levelForXp } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { GradesService } from "../grades/grades.service";

export type LeaderboardSort = "xp" | "cards" | "albums";

const ORDER_BY_SQL: Record<LeaderboardSort, Prisma.Sql> = {
  xp: Prisma.sql`up.xp DESC, "uniqueCardCount" DESC`,
  cards: Prisma.sql`"uniqueCardCount" DESC, up.xp DESC`,
  albums: Prisma.sql`"completeSeriesCount" DESC, up.xp DESC`,
};

interface LeaderboardRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  xp: number;
  uniqueCardCount: number;
  completeSeriesCount: number;
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grades: GradesService,
  ) {}

  /**
   * Ranked by XP, unique card count, or complete-series count depending on
   * `sortBy` (ties broken by XP). Only players with a public profile and an
   * active account show up here — the same visibility rule as viewing a
   * profile directly.
   */
  async top(limit = 50, sortBy: LeaderboardSort = "xp") {
    const rows = await this.prisma.$queryRaw<LeaderboardRow[]>`
      WITH published_totals AS (
        SELECT "seriesId", COUNT(*)::int AS total
        FROM "CardDefinition"
        WHERE status = 'PUBLISHED'
        GROUP BY "seriesId"
      ),
      owned_per_series AS (
        SELECT ci."ownerId", cd."seriesId", COUNT(DISTINCT ci."cardDefinitionId")::int AS owned
        FROM "CardInstance" ci
        JOIN "CardDefinition" cd ON cd.id = ci."cardDefinitionId"
        WHERE cd.status = 'PUBLISHED'
        GROUP BY ci."ownerId", cd."seriesId"
      ),
      complete_series AS (
        SELECT ops."ownerId", COUNT(*)::int AS "completeSeriesCount"
        FROM owned_per_series ops
        JOIN published_totals pt ON pt."seriesId" = ops."seriesId"
        WHERE ops.owned >= pt.total
        GROUP BY ops."ownerId"
      ),
      unique_counts AS (
        SELECT "ownerId", COUNT(DISTINCT "cardDefinitionId")::int AS "uniqueCardCount"
        FROM "CardInstance"
        GROUP BY "ownerId"
      )
      SELECT
        u.id, u.username, u."displayName", u."avatarUrl", u.role,
        up.xp,
        COALESCE(uc."uniqueCardCount", 0) AS "uniqueCardCount",
        COALESCE(cs."completeSeriesCount", 0) AS "completeSeriesCount"
      FROM "User" u
      JOIN "UserProfile" up ON up."userId" = u.id
      LEFT JOIN unique_counts uc ON uc."ownerId" = u.id
      LEFT JOIN complete_series cs ON cs."ownerId" = u.id
      WHERE u.status = 'ACTIVE' AND up."isPublic" = true
      ORDER BY ${ORDER_BY_SQL[sortBy]}
      LIMIT ${limit}
    `;

    return rows.map((row, index) => {
      const level = levelForXp(row.xp);
      return {
        rank: index + 1,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        role: row.role,
        xp: row.xp,
        level,
        grade: this.grades.gradeForLevel(level),
        uniqueCardCount: row.uniqueCardCount,
        completeSeriesCount: row.completeSeriesCount,
      };
    });
  }
}
