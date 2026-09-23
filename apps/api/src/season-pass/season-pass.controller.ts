import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SeasonPassService } from "./season-pass.service";

@ApiTags("season-pass")
@ApiBearerAuth()
@Controller({ path: "season-pass", version: "1" })
export class SeasonPassController {
  constructor(private readonly seasonPass: SeasonPassService) {}

  @Get("tiers")
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.seasonPass.listForPlayer(user.id);
  }

  @Post("tiers/:id/claim")
  async claim(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.seasonPass.claim(user.id, id);
  }
}
