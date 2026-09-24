import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { CardCategory, CardStatus, Prisma, ReportStatus } from "@railcards/database";
import type { CardSortBy } from "../catalog/catalog.service";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CatalogService } from "../catalog/catalog.service";
import { BoostersService } from "../boosters/boosters.service";
import { StorageService } from "../storage/storage.service";
import { MissionsService } from "../missions/missions.service";
import { GradesService } from "../grades/grades.service";
import { QuestsService } from "../quests/quests.service";
import { AnnouncementsService } from "../announcements/announcements.service";
import { EventsService } from "../events/events.service";
import { SeasonsService } from "../seasons/seasons.service";
import { GuildWarsService } from "../guild-wars/guild-wars.service";
import { SeasonPassService } from "../season-pass/season-pass.service";
import { ProfileBannersService } from "../profile-banners/profile-banners.service";
import { ProfileTitlesService } from "../profile-titles/profile-titles.service";
import { CardSleevesService } from "../card-sleeves/card-sleeves.service";
import { AdminUsersService } from "./admin-users.service";
import { InvitationsService } from "./invitations.service";
import { ReportsService } from "./reports.service";
import { AuditLogService } from "./audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AdjustWalletDto,
  CreateAchievementDto,
  CreateBoosterDefinitionDto,
  CreateCardDto,
  CreateGradeDto,
  CreateEventDto,
  CreateInvitationDto,
  CreateMissionDto,
  CreateQuestDto,
  CreateSeriesDto,
  GrantCardDto,
  MintSignatureCardDto,
  PublishPoolVersionDto,
  ResolveReportDto,
  UpdateAchievementDto,
  UpdateBoosterDefinitionDto,
  UpdateCardDto,
  UpdateEventDto,
  UpdateGradeDto,
  UpdateMissionDto,
  UpdateSeriesDto,
  UpsertAnnouncementDto,
  StartSeasonDto,
  StartGuildWarDto,
  CreateSeasonPassTierDto,
  UpdateSeasonPassTierDto,
} from "./dto/admin.dto";
import { CreateProfileBannerDto } from "../profile-banners/dto/profile-banner.dto";
import { CreateProfileTitleDto } from "../profile-titles/dto/profile-title.dto";
import { CreateCardSleeveDto } from "../card-sleeves/dto/card-sleeve.dto";

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
    private readonly storage: StorageService,
    private readonly missions: MissionsService,
    private readonly grades: GradesService,
    private readonly quests: QuestsService,
    private readonly announcements: AnnouncementsService,
    private readonly events: EventsService,
    private readonly seasons: SeasonsService,
    private readonly guildWars: GuildWarsService,
    private readonly seasonPass: SeasonPassService,
    private readonly profileBanners: ProfileBannersService,
    private readonly profileTitles: ProfileTitlesService,
    private readonly cardSleeves: CardSleevesService,
  ) {}

  // ── Uploads ──────────────────────────────────────────────────────
  @Post("uploads")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(@CurrentUser() admin: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file provided");
    const result = await this.storage.saveImage(file);
    await this.auditLog.record(admin.id, "upload.create", "Upload", result.filename);
    return result;
  }

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
  async listCards(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "50",
    @Query("search") search?: string,
    @Query("seriesId") seriesId?: string,
    @Query("rarity") rarityCode?: string,
    @Query("category") category?: CardCategory,
    @Query("status") status?: CardStatus,
    @Query("sortBy") sortBy?: CardSortBy,
  ) {
    const { items, total } = await this.catalog.searchCards(
      { page: Number(page) || 1, pageSize: Number(pageSize) || 50, search, seriesId, rarityCode, category, status, sortBy },
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
    const { rarityId, seriesId, combatStats, ...rest } = dto;
    const card = await this.catalog.updateCard(id, {
      ...rest,
      rarity: rarityId ? { connect: { id: rarityId } } : undefined,
      series: seriesId ? { connect: { id: seriesId } } : undefined,
      combatStats: combatStats as Prisma.InputJsonValue | undefined,
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

  @Delete("cards/:id")
  async deleteCard(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Query("cascade") cascade?: string) {
    const result = await this.catalog.deleteCard(id, cascade === "true");
    await this.auditLog.record(admin.id, "card.delete", "CardDefinition", id, { instancesRemoved: result.instancesRemoved });
    return result;
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

  @Patch("boosters/:id")
  async updateBooster(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateBoosterDefinitionDto) {
    const booster = await this.boosters.updateDefinition(id, dto);
    await this.auditLog.record(admin.id, "booster.update", "BoosterDefinition", id, dto);
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

  // ── Missions & achievements ──────────────────────────────────────
  @Get("missions")
  async listMissions() {
    return this.missions.listAllMissionsForAdmin();
  }

  @Post("missions")
  async createMission(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateMissionDto) {
    const mission = await this.missions.createMission(dto);
    await this.auditLog.record(admin.id, "mission.create", "Mission", mission.id, { code: mission.code });
    return mission;
  }

  @Patch("missions/:id")
  async updateMission(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateMissionDto) {
    const mission = await this.missions.updateMission(id, dto);
    await this.auditLog.record(admin.id, "mission.update", "Mission", id, dto);
    return mission;
  }

  @Get("achievements")
  async listAchievements() {
    return this.missions.listAllAchievementsForAdmin();
  }

  @Post("achievements")
  async createAchievement(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateAchievementDto) {
    if (dto.rewardBannerId) await this.profileBanners.requireExists(dto.rewardBannerId);
    if (dto.rewardTitleId) await this.profileTitles.requireExists(dto.rewardTitleId);
    if (dto.rewardSleeveId) await this.cardSleeves.requireExists(dto.rewardSleeveId);
    const achievement = await this.missions.createAchievement(dto);
    await this.auditLog.record(admin.id, "achievement.create", "Achievement", achievement.id, { code: achievement.code });
    return achievement;
  }

  @Patch("achievements/:id")
  async updateAchievement(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateAchievementDto) {
    if (dto.rewardBannerId) await this.profileBanners.requireExists(dto.rewardBannerId);
    if (dto.rewardTitleId) await this.profileTitles.requireExists(dto.rewardTitleId);
    if (dto.rewardSleeveId) await this.cardSleeves.requireExists(dto.rewardSleeveId);
    const achievement = await this.missions.updateAchievement(id, dto);
    await this.auditLog.record(admin.id, "achievement.update", "Achievement", id, dto);
    return achievement;
  }

  // ── Profile banners (cosmetic catalog) ─────────────────────────────
  @Get("profile-banners")
  async listProfileBanners() {
    return this.profileBanners.listCatalog();
  }

  @Post("profile-banners")
  async createProfileBanner(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateProfileBannerDto) {
    const banner = await this.profileBanners.createForAdmin(dto);
    await this.auditLog.record(admin.id, "profile-banner.create", "ProfileBanner", banner.id, { slug: banner.slug });
    return banner;
  }

  // ── Profile titles (cosmetic catalog) ───────────────────────────────
  @Get("profile-titles")
  async listProfileTitles() {
    return this.profileTitles.listCatalog();
  }

  @Post("profile-titles")
  async createProfileTitle(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateProfileTitleDto) {
    const title = await this.profileTitles.createForAdmin(dto);
    await this.auditLog.record(admin.id, "profile-title.create", "ProfileTitle", title.id, { slug: title.slug });
    return title;
  }

  // ── Card sleeves (cosmetic catalog) ─────────────────────────────────
  @Get("card-sleeves")
  async listCardSleeves() {
    return this.cardSleeves.listCatalog();
  }

  @Post("card-sleeves")
  async createCardSleeve(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateCardSleeveDto) {
    const sleeve = await this.cardSleeves.createForAdmin(dto);
    await this.auditLog.record(admin.id, "card-sleeve.create", "CardSleeve", sleeve.id, { slug: sleeve.slug });
    return sleeve;
  }

  // ── Seasonal quests ────────────────────────────────────────────────
  @Get("quests")
  async listQuests() {
    return this.quests.listAllForAdmin();
  }

  @Post("quests")
  async createQuest(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateQuestDto) {
    const quest = await this.quests.create(dto);
    await this.auditLog.record(admin.id, "quest.create", "SeasonalQuest", quest.id, { slug: quest.slug, stepCount: quest.steps.length });
    return quest;
  }

  @Patch("quests/:id/archive")
  async archiveQuest(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    const quest = await this.quests.archive(id);
    await this.auditLog.record(admin.id, "quest.archive", "SeasonalQuest", id, {});
    return quest;
  }

  // ── Site announcement ──────────────────────────────────────────────
  @Get("announcement")
  async getAnnouncement(@Res() res: Response) {
    const announcement = await this.announcements.getForAdmin();
    res.json(announcement);
  }

  @Post("announcement")
  async upsertAnnouncement(@CurrentUser() admin: AuthenticatedUser, @Body() dto: UpsertAnnouncementDto) {
    const announcement = await this.announcements.upsert(dto.message, dto.isActive);
    await this.auditLog.record(admin.id, "announcement.upsert", "SiteAnnouncement", announcement.id, { isActive: announcement.isActive });
    return announcement;
  }

  // ── Live-ops events ────────────────────────────────────────────────
  @Get("events")
  async listEvents() {
    return this.events.listAllForAdmin();
  }

  @Post("events")
  async createEvent(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateEventDto) {
    const event = await this.events.create(dto);
    await this.auditLog.record(admin.id, "event.create", "Event", event.id, { slug: event.slug });
    return event;
  }

  @Patch("events/:id")
  async updateEvent(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateEventDto) {
    const event = await this.events.update(id, dto);
    await this.auditLog.record(admin.id, "event.update", "Event", id, dto);
    return event;
  }

  // ── Seasons (resettable competitive leaderboard) ──────────────────
  @Get("seasons")
  async listSeasons() {
    return this.seasons.listAllForAdmin();
  }

  @Post("seasons")
  async startSeason(@CurrentUser() admin: AuthenticatedUser, @Body() dto: StartSeasonDto) {
    const season = await this.seasons.startNewSeason(dto.name);
    await this.auditLog.record(admin.id, "season.start", "Season", season.id, { name: season.name });
    return season;
  }

  @Post("seasons/end-active")
  async endActiveSeason(@CurrentUser() admin: AuthenticatedUser) {
    const season = await this.seasons.endActiveSeason();
    await this.auditLog.record(admin.id, "season.end", "Season", season.id, {});
    return season;
  }

  // ── Guild wars (resettable inter-guild competition) ────────────────
  @Get("guild-wars")
  async listGuildWars() {
    return this.guildWars.listAllForAdmin();
  }

  @Post("guild-wars")
  async startGuildWar(@CurrentUser() admin: AuthenticatedUser, @Body() dto: StartGuildWarDto) {
    const period = await this.guildWars.startNewPeriod(dto.name);
    await this.auditLog.record(admin.id, "guild-war.start", "GuildWarPeriod", period.id, { name: period.name });
    return period;
  }

  @Post("guild-wars/end-active")
  async endActiveGuildWar(@CurrentUser() admin: AuthenticatedUser) {
    const period = await this.guildWars.endActivePeriod();
    await this.auditLog.record(admin.id, "guild-war.end", "GuildWarPeriod", period.id, {});
    return period;
  }

  // ── Season pass (per-season milestone rewards) ─────────────────────
  @Get("season-pass/tiers")
  async listSeasonPassTiers() {
    return this.seasonPass.listForAdmin();
  }

  @Post("season-pass/tiers")
  async createSeasonPassTier(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateSeasonPassTierDto) {
    const t = await this.seasonPass.createTier(dto);
    await this.auditLog.record(admin.id, "season-pass-tier.create", "SeasonPassTier", t.id, { tier: t.tier });
    return t;
  }

  @Patch("season-pass/tiers/:id")
  async updateSeasonPassTier(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateSeasonPassTierDto) {
    const t = await this.seasonPass.updateTier(id, dto);
    await this.auditLog.record(admin.id, "season-pass-tier.update", "SeasonPassTier", id, dto);
    return t;
  }

  // ── Grades (profile ranks) ────────────────────────────────────────
  @Get("grades")
  async listGrades() {
    return this.grades.listAllForAdmin();
  }

  @Post("grades")
  async createGrade(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateGradeDto) {
    const grade = await this.grades.create(dto);
    await this.auditLog.record(admin.id, "grade.create", "Grade", grade.id, dto);
    return grade;
  }

  @Patch("grades/:id")
  async updateGrade(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateGradeDto) {
    const grade = await this.grades.update(id, dto);
    await this.auditLog.record(admin.id, "grade.update", "Grade", id, dto);
    return grade;
  }

  @Delete("grades/:id")
  async deleteGrade(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    await this.grades.delete(id);
    await this.auditLog.record(admin.id, "grade.delete", "Grade", id);
    return { deleted: true };
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

  @Post("users/:id/grant-card")
  async grantCard(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: GrantCardDto) {
    const result = await this.adminUsers.grantCard(id, dto.cardDefinitionId, dto.quantity ?? 1);
    await this.auditLog.record(admin.id, "user.grant_card", "User", id, result);
    return result;
  }

  @Post("users/:id/mint-signature-card")
  async mintSignatureCard(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string, @Body() dto: MintSignatureCardDto) {
    const result = await this.adminUsers.mintSignatureCard(id, dto.cardDefinitionId, dto.editionSize ?? 1);
    await this.auditLog.record(admin.id, "user.mint_signature_card", "User", id, result);
    return result;
  }

  @Post("users/:id/reset-cards")
  async resetUserCards(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    const result = await this.adminUsers.resetCards(id);
    await this.auditLog.record(admin.id, "user.reset_cards", "User", id, result);
    return result;
  }

  @Delete("users/:id")
  async deleteUser(@CurrentUser() admin: AuthenticatedUser, @Param("id") id: string) {
    const result = await this.adminUsers.deleteUser(id, admin.id);
    await this.auditLog.record(admin.id, "user.delete", "User", id);
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
