import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { FriendsService } from "../friends/friends.service";
import { LeaderboardService, type LeaderboardSort } from "./leaderboard.service";

const VALID_SORTS: LeaderboardSort[] = ["xp", "cards", "albums"];

@ApiTags("leaderboard")
@ApiBearerAuth()
@Controller({ path: "leaderboard", version: "1" })
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly friends: FriendsService,
  ) {}

  @Get()
  async top(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit = "50",
    @Query("sortBy") sortBy = "xp",
    @Query("scope") scope?: "all" | "friends",
  ) {
    const n = Math.min(500, Math.max(1, Number(limit) || 50));
    const sort = VALID_SORTS.includes(sortBy as LeaderboardSort) ? (sortBy as LeaderboardSort) : "xp";
    const memberIds = scope === "friends" ? [...(await this.friends.listFriendIds(user.id)), user.id] : undefined;
    return this.leaderboard.top(n, sort, memberIds);
  }
}
