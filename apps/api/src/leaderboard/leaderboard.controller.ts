import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LeaderboardService, type LeaderboardSort } from "./leaderboard.service";

const VALID_SORTS: LeaderboardSort[] = ["xp", "cards", "albums"];

@ApiTags("leaderboard")
@ApiBearerAuth()
@Controller({ path: "leaderboard", version: "1" })
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  async top(@Query("limit") limit = "50", @Query("sortBy") sortBy = "xp") {
    const n = Math.min(500, Math.max(1, Number(limit) || 50));
    const sort = VALID_SORTS.includes(sortBy as LeaderboardSort) ? (sortBy as LeaderboardSort) : "xp";
    return this.leaderboard.top(n, sort);
  }
}
