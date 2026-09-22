import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { ReportStatus } from "@railcards/database";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CatalogService } from "../catalog/catalog.service";
import { BoostersService } from "../boosters/boosters.service";
import { AdminUsersService } from "./admin-users.service";
import { InvitationsService } from "./invitations.service";
import { ReportsService } from "./reports.service";
import { AuditLogService } from "./audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AdjustWalletDto,
  CreateBoosterDefinitionDto,
  CreateCardDto,
  CreateInvitationDto,
  CreateSeriesDto,
  PublishPoolVersionDto,
  ResolveReportDto,
  UpdateCardDto,
  UpdateSeriesDto,
} from "./dto/admin.dto";

@ApiTags("admin")
@ApiBearerAuth()
@Roles("ADMIN")
@UseGuards(RolesGuard)
@Controller({ path: "admin", version: "1" })
export class AdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly boosters: BoostersService,
    private readonly adminUsers: AdminUsersService,
    private readonly invitations: InvitationsService,
    private readonly reports: ReportsService,
    private readonly auditLog: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Catalog ──────────────────────────────────────────────────────
  @Get("series")
  async listSeries() {
    return this.catalog.listAllSeriesForAdmin();
  }

  @Post("series")
  async createSeries(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateSeriesDto) {
    const series = await this.catalog.createSeries(dto as never);
    await this.auditLog.record(admin.id, "series.create", "CardSeries", series.id, { slug: series.slug });
    return series;
  }

  @Patch("series/:id")
  async updateSeries(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateSeriesDto) {
    const series = await this.catalog.updateSeries(id, dto);
    await this.auditLog.record(admin.id, "series.update", "CardSeries", id, dto);
    return series;
  }

  @Get("cards")
  async listCards(@Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    const { items, total } = await this.catalog.searchCards(
      { page: Number(page) || 1, pageSize: Number(pageSize) || 50 },
      true,
    );
    return { items, total };
  }

  @Post("cards")
  async createCard(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateCardDto) {
    const { seriesId, rarityId, ...rest } = dto;
    const card = await this.catalog.createCard({
      ...rest,
      status: dto.status ?? "DRAFT",
      series: { connect: { id: seriesId } },
      rarity: { connect: { id: rarityId } },
    });
    await this.auditLog.record(admin.id, "card.create", "CardDefinition", card.id, { slug: card.slug });
    return card;
  }

  @Patch("cards/:id")
  async updateCard(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateCardDto) {
    const { rarityId, ...rest } = dto;
    const card = await this.catalog.updateCard(id, {
      ...rest,
      rarity: rarityId ? { connect: { id: rarityId } } : undefined,
    });
    await this.auditLog.record(admin.id, "card.update", "CardDefinition", id, dto);
    return card;
  }

  @Post("cards/:id/publish")
  async publishCard(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    const card = await this.catalog.setCardStatus(id, "PUBLISHED");
    await this.auditLog.record(admin.id, "card.publish", "CardDefinition", id);
    return card;
  }

  @Post("cards/:id/archive")
  async archiveCard(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    const card = await this.catalog.setCardStatus(id, "ARCHIVED");
    await this.auditLog.record(admin.id, "card.archive", "CardDefinition", id);
    return card;
  }

  // ── Boosters ─────────────────────────────────────────────────────
  @Get("boosters")
  async listBoosters() {
    return this.boosters.listAllDefinitionsForAdmin();
  }

  @Post("boosters")
  async createBooster(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateBoosterDefinitionDto) {
    const booster = await this.boosters.createDefinition(dto);
    await this.auditLog.record(admin.id, "booster.create", "BoosterDefinition", booster.id, { slug: booster.slug });
    return booster;
  }

  @Post("boosters/:id/pool")
  async publishPool(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: PublishPoolVersionDto) {
    const pool = await this.boosters.publishNewPoolVersion(id, dto.entries);
    await this.auditLog.record(admin.id, "booster.publish_pool", "BoosterDefinition", id, {
      rulesVersion: pool.rulesVersion,
    });
    return pool;
  }

  // ── Invitations ──────────────────────────────────────────────────
  @Get("invitations")
  async listInvitations(@Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    return this.invitations.list(Number(page) || 1, Number(pageSize) || 50);
  }

  @Post("invitations")
  async createInvitation(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateInvitationDto) {
    const invitation = await this.invitations.create(admin.id, dto);
    await this.auditLog.record(admin.id, "invitation.create", "Invitation", invitation.id);
    return invitation;
  }

  // ── Users ────────────────────────────────────────────────────────
  @Get("users")
  async listUsers(@Query("search") search?: string, @Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    return this.adminUsers.list(search, Number(page) || 1, Number(pageSize) || 50);
  }

  @Post("users/:id/suspend")
  async suspendUser(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    const user = await this.adminUsers.suspend(id, admin.id);
    await this.auditLog.record(admin.id, "user.suspend", "User", id);
    return user;
  }

  @Post("users/:id/reactivate")
  async reactivateUser(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    const user = await this.adminUsers.reactivate(id);
    await this.auditLog.record(admin.id, "user.reactivate", "User", id);
    return user;
  }

  @Post("users/:id/wallet-adjustment")
  async adjustUserWallet(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: AdjustWalletDto) {
    const result = await this.adminUsers.adjustWallet(id, dto.amount, dto.reason);
    await this.auditLog.record(admin.id, "user.wallet_adjustment", "User", id, {
      amount: dto.amount,
      reason: dto.reason,
      newBalance: result.balance,
    });
    return result;
  }

  // ── Reports ──────────────────────────────────────────────────────
  @Get("reports")
  async listReports(@Query("status") status?: ReportStatus, @Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    return this.reports.list(status, Number(page) || 1, Number(pageSize) || 50);
  }

  @Post("reports/:id/resolve")
  async resolveReport(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: ResolveReportDto) {
    const report = await this.reports.resolve(id, admin.id, dto.status);
    await this.auditLog.record(admin.id, `report.${dto.status.toLowerCase()}`, "Report", id);
    return report;
  }

  // ── Transactions & audit ─────────────────────────────────────────
  @Get("wallet-transactions")
  async walletTransactions(@Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 50;
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        include: { wallet: { include: { user: { select: { username: true } } } } },
        orderBy: { createdAt: "desc" },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.walletTransaction.count(),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Get("market-transactions")
  async marketTransactions(@Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 50;
    const [items, total] = await Promise.all([
      this.prisma.marketTransaction.findMany({
        include: {
          buyer: { select: { username: true } },
          seller: { select: { username: true } },
          listing: { include: { cardInstance: { include: { cardDefinition: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.marketTransaction.count(),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Get("audit-log")
  async auditLogList(@Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    return this.auditLog.list(Number(page) || 1, Number(pageSize) || 50);
  }
}
