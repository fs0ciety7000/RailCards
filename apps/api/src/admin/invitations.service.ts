import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode(): string {
    return randomBytes(6).toString("hex").toUpperCase();
  }

  async create(createdByUserId: string, params: { email?: string; maxUses?: number; expiresInDays?: number }) {
    return this.prisma.invitation.create({
      data: {
        code: this.generateCode(),
        createdByUserId,
        email: params.email,
        maxUses: params.maxUses ?? 1,
        expiresAt: params.expiresInDays ? new Date(Date.now() + params.expiresInDays * 86_400_000) : null,
      },
    });
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.invitation.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invitation.count(),
    ]);
    return { items, total };
  }
}
