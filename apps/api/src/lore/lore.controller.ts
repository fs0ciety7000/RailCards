import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { LoreService } from "./lore.service";

@ApiTags("lore")
@ApiBearerAuth()
@Controller({ path: "lore", version: "1" })
export class LoreController {
  constructor(private readonly lore: LoreService) {}

  @Get()
  async book(@CurrentUser() user: AuthenticatedUser, @Query("seriesId") seriesId?: string) {
    return this.lore.getBook(user.id, seriesId);
  }
}
