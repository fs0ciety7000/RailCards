import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { CardCategory } from "@railcards/database";
import { CatalogService } from "./catalog.service";

@ApiTags("catalog")
@ApiBearerAuth()
@Controller({ version: "1" })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("rarities")
  async rarities() {
    return this.catalog.listRarities();
  }

  @Get("series")
  async series() {
    return this.catalog.listSeries();
  }

  @Get("cards")
  async cards(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("search") search?: string,
    @Query("seriesId") seriesId?: string,
    @Query("rarity") rarityCode?: string,
    @Query("category") category?: CardCategory,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.catalog.searchCards(
      { page: p, pageSize: ps, search, seriesId, rarityCode, category },
      false,
    );
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Get("cards/:id")
  async cardById(@Param("id") id: string) {
    return this.catalog.getCardById(id, false);
  }
}
