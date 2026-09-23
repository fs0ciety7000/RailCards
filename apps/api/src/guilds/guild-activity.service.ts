import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService, type ActivityEvent, type PublicUser } from "../activity/activity.service";

interface GuildMemberJoinedEvent {
  type: "GUILD_MEMBER_JOINED";
  occurredAt: Date;
  member: PublicUser;
}

interface GuildQuestStepEvent {
  type: "QUEST_STEP_COMPLETED";
  occurredAt: Date;
  member: PublicUser;
  questTitle: string;
  stepTitle: string;
}

export type GuildActivityEvent = ActivityEvent | GuildMemberJoinedEvent | GuildQuestStepEvent;

const PUBLIC_USER_SELECT = { username: true, displayName: true } as const;

@Injectable()
export class GuildActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * A guild's own activity feed: the same network-wide event sources as
   * ActivityService (sales, trades, duels, series completions, rare pulls)
   * filtered down to this guild's current members via the same
   * friends-style username filter, merged with two guild-specific sources
   * that ActivityService has no concept of — members joining, and quest
   * step completions — so this is a genuinely distinct view, not just the
   * chat log's dates re-sorted.
   */
  async getFeed(userId: string, guildId: string, limit: number): Promise<GuildActivityEvent[]> {
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
      include: { user: { select: PUBLIC_USER_SELECT } },
    });
    if (!members.some((m) => m.userId === userId)) {
      throw new ForbiddenException("You are not a member of this guild");
    }

    const usernames = new Set(members.map((m) => m.user.username));
    const memberIds = members.map((m) => m.userId);

    const [networkEvents, questSteps] = await Promise.all([
      this.activity.getFeed(limit, usernames),
      this.prisma.userQuestProgress.findMany({
        where: { userId: { in: memberIds }, completedAt: { not: null } },
        include: { user: { select: PUBLIC_USER_SELECT }, questStep: { include: { quest: { select: { title: true } } } } },
        orderBy: { completedAt: "desc" },
        take: limit,
      }),
    ]);

    const joinEvents: GuildMemberJoinedEvent[] = members.map((m) => ({
      type: "GUILD_MEMBER_JOINED",
      occurredAt: m.joinedAt,
      member: m.user,
    }));
    const questEvents: GuildQuestStepEvent[] = questSteps.map((p) => ({
      type: "QUEST_STEP_COMPLETED",
      occurredAt: p.completedAt!,
      member: p.user,
      questTitle: p.questStep.quest.title,
      stepTitle: p.questStep.title,
    }));

    const merged: GuildActivityEvent[] = [...networkEvents, ...joinEvents, ...questEvents];
    merged.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return merged.slice(0, limit);
  }
}
