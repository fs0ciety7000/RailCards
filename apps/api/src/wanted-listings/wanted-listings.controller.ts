import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { WantedListingsService } from "./wanted-listings.service";
import { CreateWantedListingDto } from "./dto/wanted-listing.dto";

@ApiTags("wanted-listings")
@ApiBearerAuth()
@Controller({ path: "wanted", version: "1" })
export class WantedListingsController {
  constructor(private readonly wanted: WantedListingsService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWantedListingDto) {
    return this.wanted.create(user.id, dto.cardDefinitionId, dto.note);
  }

  @Get()
  async list(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("cardDefinitionId") cardDefinitionId?: string,
    @Query("search") search?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.wanted.listOpen({ page: p, pageSize: ps, cardDefinitionId, search });
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Get("mine")
  async mine(@CurrentUser() user: AuthenticatedUser) {
    return this.wanted.listMine(user.id);
  }

  @Post(":id/fulfill")
  async fulfill(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.wanted.fulfill(user.id, id);
  }

  @Post(":id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.wanted.cancel(user.id, id);
  }
}
