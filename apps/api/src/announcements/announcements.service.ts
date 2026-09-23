import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const SINGLETON_ID = "singleton";

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: the announcement to show under the navbar, or null when none is published. */
  async getActive() {
    const row = await this.prisma.siteAnnouncement.findUnique({ where: { id: SINGLETON_ID } });
    if (!row || !row.isActive) return null;
    return { message: row.message, updatedAt: row.updatedAt };
  }

  /** Admin: the single announcement row regardless of published state (so it stays editable even while unpublished), or null if never created. */
  async getForAdmin() {
    return this.prisma.siteAnnouncement.findUnique({ where: { id: SINGLETON_ID } });
  }

  async upsert(message: string, isActive: boolean) {
    return this.prisma.siteAnnouncement.upsert({
      where: { id: SINGLETON_ID },
      update: { message, isActive },
      create: { id: SINGLETON_ID, message, isActive },
    });
  }
}
