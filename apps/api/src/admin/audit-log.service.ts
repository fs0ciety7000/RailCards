import { Injectable } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(actorUserId: string, action: string, targetType: string, targetId: string, metadata?: unknown) {
    return this.prisma.auditLog.create({
      data: { actorUserId, action, targetType, targetId, metadata: metadata as Prisma.InputJsonValue | undefined },
    });
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { actor: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total };
  }
}
