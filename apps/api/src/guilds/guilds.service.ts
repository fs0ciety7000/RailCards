import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { levelForXp } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { GradesService } from "../grades/grades.service";

type Tx = Prisma.TransactionClient;

interface GuildLeaderboardRow {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  totalXp: number;
  totalUniqueCards: number;
}

const GUILD_INCLUDE = {
  leader: { select: { username: true, displayName: true } },
  members: {
    orderBy: { joinedAt: "asc" as const },
    include: { user: { select: { username: true, displayName: true, avatarUrl: true, profile: { select: { xp: true } } } } },
  },
} satisfies Prisma.GuildInclude;

@Injectable()
export class GuildsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly grades: GradesService,
  ) {}

  private present(guild: Prisma.GuildGetPayload<{ include: typeof GUILD_INCLUDE }>) {
    return {
      id: guild.id,
      name: guild.name,
      tag: guild.tag,
      description: guild.description,
      leaderId: guild.leaderId,
      leader: guild.leader,
      createdAt: guild.createdAt,
      memberCount: guild.members.length,
      members: guild.members.map((m) => {
        const xp = m.user.profile?.xp ?? 0;
        const level = levelForXp(xp);
        return {
          userId: m.userId,
          username: m.user.username,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt,
          xp,
          level,
          grade: this.grades.gradeForLevel(level),
        };
      }),
    };
  }

  private async loadOrThrow(tx: Tx | PrismaService, guildId: string) {
    const guild = await tx.guild.findUnique({ where: { id: guildId }, include: GUILD_INCLUDE });
    if (!guild) throw new NotFoundException("Guild not found");
    return guild;
  }

  async create(userId: string, name: string, tag: string, description?: string) {
    const existingMembership = await this.prisma.guildMember.findUnique({ where: { userId } });
    if (existingMembership) throw new ConflictException("You're already in a guild — leave it first.");

    const normalizedTag = tag.toUpperCase();
    const [nameTaken, tagTaken] = await Promise.all([
      this.prisma.guild.findUnique({ where: { name } }),
      this.prisma.guild.findUnique({ where: { tag: normalizedTag } }),
    ]);
    if (nameTaken) throw new ConflictException("A guild with this name already exists");
    if (tagTaken) throw new ConflictException("A guild with this tag already exists");

    const guild = await this.prisma.$transaction(async (tx) => {
      const created = await tx.guild.create({ data: { name, tag: normalizedTag, description, leaderId: userId } });
      await tx.guildMember.create({ data: { guildId: created.id, userId, role: "LEADER" } });
      return this.loadOrThrow(tx, created.id);
    });
    return this.present(guild);
  }

  async list(search: string | undefined, page: number, pageSize: number) {
    const where: Prisma.GuildWhereInput = search
      ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { tag: { contains: search, mode: "insensitive" } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.guild.findMany({
        where,
        include: GUILD_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.guild.count({ where }),
    ]);
    return { items: items.map((g) => this.present(g)), total };
  }

  async getById(guildId: string) {
    const guild = await this.loadOrThrow(this.prisma, guildId);
    return this.present(guild);
  }

  /** The guild the given user currently belongs to, or null. */
  async mine(userId: string) {
    const membership = await this.prisma.guildMember.findUnique({ where: { userId } });
    if (!membership) return null;
    return this.getById(membership.guildId);
  }

  async join(userId: string, guildId: string) {
    const existingMembership = await this.prisma.guildMember.findUnique({ where: { userId } });
    if (existingMembership) throw new ConflictException("You're already in a guild — leave it first.");

    const guild = await this.prisma.guild.findUnique({ where: { id: guildId }, include: { _count: { select: { members: true } } } });
    if (!guild) throw new NotFoundException("Guild not found");
    if (guild._count.members >= GAME_CONSTANTS.GUILD_MAX_MEMBERS) {
      throw new ConflictException("This guild is full");
    }

    await this.prisma.$transaction(async (tx) => {
      // Re-check membership and headcount inside the transaction to close
      // the race between the pre-flight checks above and this write.
      const stillFree = await tx.guildMember.findUnique({ where: { userId } });
      if (stillFree) throw new ConflictException("You're already in a guild — leave it first.");
      const memberCount = await tx.guildMember.count({ where: { guildId } });
      if (memberCount >= GAME_CONSTANTS.GUILD_MAX_MEMBERS) throw new ConflictException("This guild is full");
      await tx.guildMember.create({ data: { guildId, userId, role: "MEMBER" } });
    });
    return this.getById(guildId);
  }

  /**
   * Removes `userId` from whatever guild they're in. A leader stepping down
   * hands leadership to the longest-tenured remaining member; the last
   * member leaving disbands the guild outright (GuildMember rows cascade
   * with it). Shared by the self-service `leave` endpoint and admin account
   * deletion, since both need the exact same "don't leave a leaderless
   * guild or a dangling Guild.leaderId behind" handling.
   */
  private async leaveInternal(tx: Tx, userId: string): Promise<void> {
    const membership = await tx.guildMember.findUnique({ where: { userId } });
    if (!membership) return;

    if (membership.role !== "LEADER") {
      await tx.guildMember.delete({ where: { userId } });
      return;
    }

    const successor = await tx.guildMember.findFirst({
      where: { guildId: membership.guildId, userId: { not: userId } },
      orderBy: { joinedAt: "asc" },
    });

    if (!successor) {
      await tx.guild.delete({ where: { id: membership.guildId } });
      return;
    }

    await tx.guild.update({ where: { id: membership.guildId }, data: { leaderId: successor.userId } });
    await tx.guildMember.update({ where: { userId: successor.userId }, data: { role: "LEADER" } });
    await tx.guildMember.delete({ where: { userId } });
    await this.notifications.create(tx, successor.userId, "GUILD_LEADERSHIP_TRANSFERRED", { guildId: membership.guildId });
  }

  async leave(userId: string) {
    const membership = await this.prisma.guildMember.findUnique({ where: { userId } });
    if (!membership) throw new NotFoundException("You're not in a guild");
    await this.prisma.$transaction((tx) => this.leaveInternal(tx, userId));
    return { left: true };
  }

  /** Exposed for AdminUsersService.deleteUser — same cleanup, reusing the caller's transaction. */
  async leaveOnAccountDeletion(tx: Tx, userId: string): Promise<void> {
    await this.leaveInternal(tx, userId);
  }

  private async requireRole(guildId: string, userId: string, allowed: Array<"LEADER" | "OFFICER">) {
    const membership = await this.prisma.guildMember.findUnique({ where: { userId } });
    if (!membership || membership.guildId !== guildId) throw new ForbiddenException("You're not a member of this guild");
    if (!allowed.includes(membership.role as "LEADER" | "OFFICER")) {
      throw new ForbiddenException("You don't have permission to do that");
    }
    return membership;
  }

  async kick(actingUserId: string, guildId: string, targetUserId: string) {
    if (actingUserId === targetUserId) throw new BadRequestException("Use \"leave\" to remove yourself");
    const acting = await this.requireRole(guildId, actingUserId, ["LEADER", "OFFICER"]);
    const target = await this.prisma.guildMember.findUnique({ where: { userId: targetUserId } });
    if (!target || target.guildId !== guildId) throw new NotFoundException("This player isn't in the guild");
    if (target.role === "LEADER") throw new ConflictException("The leader can't be kicked");
    if (target.role === "OFFICER" && acting.role !== "LEADER") {
      throw new ForbiddenException("Only the leader can remove an officer");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.guildMember.delete({ where: { userId: targetUserId } });
      await this.notifications.create(tx, targetUserId, "GUILD_KICKED", { guildId });
    });
    return this.getById(guildId);
  }

  async setOfficerRole(actingUserId: string, guildId: string, targetUserId: string, promote: boolean) {
    await this.requireRole(guildId, actingUserId, ["LEADER"]);
    const target = await this.prisma.guildMember.findUnique({ where: { userId: targetUserId } });
    if (!target || target.guildId !== guildId) throw new NotFoundException("This player isn't in the guild");
    if (target.role === "LEADER") throw new ConflictException("The leader's role can't be changed this way");
    const expectedCurrent = promote ? "MEMBER" : "OFFICER";
    if (target.role !== expectedCurrent) {
      throw new ConflictException(promote ? "This player is already an officer" : "This player is already a regular member");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.guildMember.update({ where: { userId: targetUserId }, data: { role: promote ? "OFFICER" : "MEMBER" } });
      await this.notifications.create(tx, targetUserId, promote ? "GUILD_PROMOTED" : "GUILD_DEMOTED", { guildId });
    });
    return this.getById(guildId);
  }

  async transferLeadership(actingUserId: string, guildId: string, targetUserId: string) {
    await this.requireRole(guildId, actingUserId, ["LEADER"]);
    if (actingUserId === targetUserId) throw new BadRequestException("You're already the leader");
    const target = await this.prisma.guildMember.findUnique({ where: { userId: targetUserId } });
    if (!target || target.guildId !== guildId) throw new NotFoundException("This player isn't in the guild");

    await this.prisma.$transaction(async (tx) => {
      await tx.guild.update({ where: { id: guildId }, data: { leaderId: targetUserId } });
      await tx.guildMember.update({ where: { userId: targetUserId }, data: { role: "LEADER" } });
      await tx.guildMember.update({ where: { userId: actingUserId }, data: { role: "OFFICER" } });
      await this.notifications.create(tx, targetUserId, "GUILD_LEADERSHIP_TRANSFERRED", { guildId });
    });
    return this.getById(guildId);
  }

  async disband(actingUserId: string, guildId: string) {
    await this.requireRole(guildId, actingUserId, ["LEADER"]);

    await this.prisma.$transaction(async (tx) => {
      const otherMembers = await tx.guildMember.findMany({ where: { guildId, userId: { not: actingUserId } } });
      await tx.guild.delete({ where: { id: guildId } });
      for (const member of otherMembers) {
        await this.notifications.create(tx, member.userId, "GUILD_DISBANDED", { guildId });
      }
    });
    return { disbanded: true };
  }

  async leaderboard(limit = 50) {
    const rows = await this.prisma.$queryRaw<GuildLeaderboardRow[]>`
      WITH unique_counts AS (
        SELECT "ownerId", COUNT(DISTINCT "cardDefinitionId")::int AS "uniqueCardCount"
        FROM "CardInstance"
        GROUP BY "ownerId"
      )
      SELECT
        g.id, g.name, g.tag,
        COUNT(gm."userId")::int AS "memberCount",
        COALESCE(SUM(up.xp), 0)::int AS "totalXp",
        COALESCE(SUM(uc."uniqueCardCount"), 0)::int AS "totalUniqueCards"
      FROM "Guild" g
      JOIN "GuildMember" gm ON gm."guildId" = g.id
      JOIN "UserProfile" up ON up."userId" = gm."userId"
      LEFT JOIN unique_counts uc ON uc."ownerId" = gm."userId"
      GROUP BY g.id
      ORDER BY "totalXp" DESC
      LIMIT ${limit}
    `;
    return rows.map((row, index) => ({ rank: index + 1, ...row }));
  }
}
