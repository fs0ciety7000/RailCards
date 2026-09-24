import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { BoostersService } from "./boosters.service";

export class OpenBoosterDto {
  @IsString()
  @MinLength(1)
  boosterSlug!: string;
}

@ApiTags("boosters")
@ApiBearerAuth()
@Controller({ path: "boosters", version: "1" })
export class BoostersController {
  constructor(private readonly boosters: BoostersService) {}

  @Get()
  async list() {
    return this.boosters.listDefinitions();
  }

  @Get(":slug/odds")
  async odds(@Param("slug") slug: string) {
    return this.boosters.odds(slug);
  }

  @Get("history")
  async history(@CurrentUser() user: AuthenticatedUser, @Query("page") page = "1", @Query("pageSize") pageSize = "10") {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const { items, total } = await this.boosters.getHistory(user.id, p, ps);
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Post("open")
  async open(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OpenBoosterDto,
    @Headers("idempotency-key") idempotencyKey: string,
  ) {
    return this.boosters.open(user.id, dto.boosterSlug, idempotencyKey);
  }

  @Get("free/status")
  async freeStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.boosters.freeBoosterStatus(user.id);
  }

  @Post("free/claim")
  async claimFree(@CurrentUser() user: AuthenticatedUser) {
    return this.boosters.claimFreeBooster(user.id);
  }
}
