import { Injectable, Optional } from "@nestjs/common";
import type { NotificationType, Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "./realtime.gateway";

type Tx = Prisma.TransactionClient;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  async create(tx: Tx, userId: string, type: NotificationType, payload: Record<string, unknown>) {
    const notification = await tx.notification.create({
      data: { userId, type, payload: payload as Prisma.InputJsonValue },
    });
    this.realtime?.pushNotification(userId, notification);
    return notification;
  }

  async list(userId: string, page: number, pageSize: number) {
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
