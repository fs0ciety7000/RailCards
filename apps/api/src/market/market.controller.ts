import { Controller, Delete, Get, Param, Post, Body, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MarketService } from "./market.service";
import { CreateListingDto, PlaceBidDto } from "./dto/create-listing.dto";

@ApiTags("market")
@ApiBearerAuth()
@Controller({ path: "market", version: "1" })
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get("listings")
  async listings(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("search") search?: string,
    @Query("seriesId") seriesId?: string,
    @Query("rarity") rarityCode?: string,
    @Query("listingType") listingType?: "FIXED" | "AUCTION",
    @Query("sort") sort?: "price_asc" | "price_desc" | "recent",
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.market.listActive({ page: p, pageSize: ps, search, seriesId, rarityCode, listingType, sort });
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Get("transactions")
  async myTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.market.listMyTransactions(user.id, p, ps);
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Get("listings/:id")
  async listingById(@Param("id") id: string) {
    return this.market.getListingById(id);
  }

  @Post("listings")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListingDto) {
    return this.market.createListing(user.id, dto.cardInstanceId, dto.priceCr, dto.listingType, dto.durationHours);
  }

  @Post("listings/:id/buy")
  async buy(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.market.buy(user.id, id);
  }

  @Post("listings/:id/bid")
  async bid(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: PlaceBidDto) {
    return this.market.placeBid(user.id, id, dto.amountCr);
  }

  @Post("listings/:id/settle")
  async settle(@Param("id") id: string) {
    return this.market.settleExpiredAuction(id);
  }

  @Delete("listings/:id")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.market.cancelListing(user.id, id);
  }
}
