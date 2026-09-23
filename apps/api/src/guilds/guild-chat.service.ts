import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const MESSAGE_INCLUDE = {
  author: { select: { username: true, displayName: true, avatarUrl: true } },
} as const;

@Injectable()
export class GuildChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireMembership(userId: string, guildId: string) {
    const membership = await this.prisma.guildMember.findUnique({ where: { userId } });
    if (!membership || membership.guildId !== guildId) throw new ForbiddenException("You're not a member of this guild");
  }

  /** Most recent messages first (as stored), reversed to chronological order for display. */
  async list(userId: string, guildId: string, limit = 50) {
    await this.requireMembership(userId, guildId);
    const messages = await this.prisma.guildMessage.findMany({
      where: { guildId },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, limit)),
    });
    return messages.reverse();
  }

  async post(userId: string, guildId: string, body: string) {
    await this.requireMembership(userId, guildId);
    const message = await this.prisma.guildMessage.create({
      data: { guildId, authorId: userId, body },
      include: MESSAGE_INCLUDE,
    });

    const members = await this.prisma.guildMember.findMany({ where: { guildId }, select: { userId: true } });
    this.notifications.broadcastToUsers(
      members.map((m) => m.userId),
      "guild-message",
      message,
    );

    return message;
  }
}
