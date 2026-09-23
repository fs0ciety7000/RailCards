import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ActivityService } from "./activity.service";
import { FriendsService } from "../friends/friends.service";

@ApiTags("activity")
@ApiBearerAuth()
@Controller({ path: "activity", version: "1" })
export class ActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly friends: FriendsService,
  ) {}

  @Get()
  async feed(@CurrentUser() user: AuthenticatedUser, @Query("limit") limit = "30", @Query("scope") scope?: "all" | "friends") {
    const l = Math.min(100, Math.max(1, Number(limit) || 30));
    const onlyUsernames = scope === "friends" ? await this.friends.listFriendUsernames(user.id) : undefined;
    return this.activity.getFeed(l, onlyUsernames);
  }
}
