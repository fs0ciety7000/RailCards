import { Injectable } from "@nestjs/common";
import type { Prisma } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The event currently in effect: admin-enabled (`isActive`) AND inside its
   * [startsAt, endsAt] window. Two separate gates on purpose — an admin can
   * author next week's event ahead of time without it going live early, and
   * can kill-switch a live event without deleting its scheduled window.
   */
  private async findEffective(client: PrismaService | Tx) {
    const now = new Date();
    return client.event.findFirst({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { startsAt: "desc" },
    });
  }

  async getActive() {
    return this.findEffective(this.prisma);
  }

  /** Basis-points multiplier (10000 = 1x) in effect right now, for use inside a transaction. */
  async getActiveXpMultiplierBps(tx: Tx): Promise<number> {
    const event = await this.findEffective(tx);
    return event?.xpMultiplierBps ?? 10_000;
  }

  // ── Admin write operations ──────────────────────────────────────────

  async listAllForAdmin() {
    return this.prisma.event.findMany({ orderBy: { startsAt: "desc" } });
  }

  async create(data: {
    slug: string;
    title: string;
    description: string;
    bannerImageUrl?: string;
    startsAt: Date;
    endsAt: Date;
    xpMultiplierBps?: number;
  }) {
    return this.prisma.event.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      bannerImageUrl: string | null;
      startsAt: Date;
      endsAt: Date;
      xpMultiplierBps: number;
      isActive: boolean;
    }>,
  ) {
    return this.prisma.event.update({ where: { id }, data });
  }
}
