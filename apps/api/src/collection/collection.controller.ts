import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { CardInstanceState } from "@railcards/database";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CollectionService } from "./collection.service";

@ApiTags("collection")
@ApiBearerAuth()
@Controller({ path: "collection", version: "1" })
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  async inventory(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "24",
    @Query("seriesId") seriesId?: string,
    @Query("rarity") rarityCode?: string,
    @Query("state") state?: CardInstanceState,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 24));
    const { items, total } = await this.collection.listInventory(user.id, {
      page: p,
      pageSize: ps,
      seriesId,
      rarityCode,
      state,
    });
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Get("album")
  async album(@CurrentUser() user: AuthenticatedUser) {
    return this.collection.getAlbum(user.id);
  }

  @Get("album/:seriesId")
  async albumSeries(@CurrentUser() user: AuthenticatedUser, @Param("seriesId") seriesId: string) {
    return this.collection.getAlbumSeries(user.id, seriesId);
  }

  @Get("missing")
  async missing(@CurrentUser() user: AuthenticatedUser, @Query("seriesId") seriesId?: string) {
    return this.collection.getMissingCards(user.id, seriesId);
  }

  @Get(":instanceId")
  async instanceDetail(@CurrentUser() user: AuthenticatedUser, @Param("instanceId") instanceId: string) {
    return this.collection.getInstanceDetail(user.id, instanceId);
  }
}
