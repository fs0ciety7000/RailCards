import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { DuelsService } from "./duels.service";
import { AcceptDuelDto, CreateDuelDto } from "./dto/duel.dto";

@ApiTags("duels")
@ApiBearerAuth()
@Controller({ path: "duels", version: "1" })
export class DuelsController {
  constructor(private readonly duels: DuelsService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDuelDto) {
    return this.duels.create(user.id, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("direction") direction: "sent" | "received" | "all" = "all",
    @Query("status") status?: string,
  ) {
    return this.duels.list(user.id, direction, status);
  }

  @Get(":id")
  async getById(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.duels.getById(user.id, id);
  }

  @Post(":id/accept")
  async accept(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AcceptDuelDto) {
    return this.duels.accept(user.id, id, dto.cardInstanceId);
  }

  @Post(":id/decline")
  async decline(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.duels.decline(user.id, id);
  }

  @Post(":id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.duels.cancel(user.id, id);
  }
}
