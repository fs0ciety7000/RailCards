import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search: string | undefined, page: number, pageSize: number) {
    const where = search
      ? { OR: [{ username: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async suspend(targetUserId: string, actingAdminId: string) {
    if (targetUserId === actingAdminId) throw new BadRequestException("You cannot suspend your own account");
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");
    // Revoking sessions on suspension prevents a currently-logged-in user
    // from continuing to use a live access token after being suspended
    // (the access token itself remains valid until it expires, but every
    // refresh and every fresh login is blocked).
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: targetUserId }, data: { status: "SUSPENDED" } });
      await tx.session.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
  }

  async reactivate(targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");
    return this.prisma.user.update({ where: { id: targetUserId }, data: { status: "ACTIVE" } });
  }
}
