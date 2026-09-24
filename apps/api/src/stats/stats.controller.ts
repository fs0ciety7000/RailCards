import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { StatsService } from "./stats.service";

@ApiTags("stats")
@ApiBearerAuth()
@Controller({ path: "stats", version: "1" })
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get("me")
  async myStats(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.myStats(user.id);
  }
}
