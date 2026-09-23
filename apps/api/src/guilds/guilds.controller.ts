import { Body, Controller, Delete, Get, Param, Post, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { GuildsService } from "./guilds.service";
import { CreateGuildDto } from "./dto/guild.dto";

@ApiTags("guilds")
@ApiBearerAuth()
@Controller({ path: "guilds", version: "1" })
export class GuildsController {
  constructor(private readonly guilds: GuildsService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGuildDto) {
    return this.guilds.create(user.id, dto.name, dto.tag, dto.description);
  }

  @Get()
  async list(@Query("search") search?: string, @Query("page") page = "1", @Query("pageSize") pageSize = "20") {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.guilds.list(search, p, ps);
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Get("leaderboard")
  async leaderboard(@Query("limit") limit = "50") {
    return this.guilds.leaderboard(Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  // NestJS treats a returned `null` the same as `undefined` and sends an
  // empty body instead of JSON "null" — breaking `Guild | null` as a
  // contract. Bypassing the automatic response handling with a raw @Res()
  // is what actually gets a literal `null` onto the wire.
  @Get("mine")
  async mine(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const guild = await this.guilds.mine(user.id);
    res.json(guild);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.guilds.getById(id);
  }

  @Post(":id/join")
  async join(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.guilds.join(user.id, id);
  }

  @Post("leave")
  async leave(@CurrentUser() user: AuthenticatedUser) {
    return this.guilds.leave(user.id);
  }

  @Post(":id/members/:userId/kick")
  async kick(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("userId") userId: string) {
    return this.guilds.kick(user.id, id, userId);
  }

  @Post(":id/members/:userId/promote")
  async promote(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("userId") userId: string) {
    return this.guilds.setOfficerRole(user.id, id, userId, true);
  }

  @Post(":id/members/:userId/demote")
  async demote(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("userId") userId: string) {
    return this.guilds.setOfficerRole(user.id, id, userId, false);
  }

  @Post(":id/members/:userId/transfer-leadership")
  async transferLeadership(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("userId") userId: string) {
    return this.guilds.transferLeadership(user.id, id, userId);
  }

  @Delete(":id")
  async disband(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.guilds.disband(user.id, id);
  }
}
