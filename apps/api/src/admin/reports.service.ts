import { Injectable, NotFoundException } from "@nestjs/common";
import type { ReportStatus } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async fileReport(reporterId: string, targetUserId: string, reason: string, details?: string) {
    return this.prisma.report.create({ data: { reporterId, targetUserId, reason, details } });
  }

  async list(status: ReportStatus | undefined, page: number, pageSize: number) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: { select: { username: true } },
          targetUser: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total };
  }

  async resolve(reportId: string, adminId: string, status: "RESOLVED" | "DISMISSED") {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Report not found");
    return this.prisma.report.update({
      where: { id: reportId },
      data: { status, resolvedByUserId: adminId, resolvedAt: new Date() },
    });
  }
}
