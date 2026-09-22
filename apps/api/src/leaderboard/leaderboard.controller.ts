import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LeaderboardService } from "./leaderboard.service";

@ApiTags("leaderboard")
@ApiBearerAuth()
@Controller({ path: "leaderboard", version: "1" })
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  async top(@Query("limit") limit = "50") {
    const n = Math.min(500, Math.max(1, Number(limit) || 50));
    return this.leaderboard.top(n);
  }
}
