import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { FriendsService } from "./friends.service";
import { SendFriendRequestDto } from "./dto/friend.dto";

@ApiTags("friends")
@ApiBearerAuth()
@Controller({ path: "friends", version: "1" })
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.friends.listFriends(user.id);
  }

  @Get("requests")
  async listRequests(@CurrentUser() user: AuthenticatedUser, @Query("direction") direction: "incoming" | "outgoing" = "incoming") {
    return this.friends.listRequests(user.id, direction === "outgoing" ? "outgoing" : "incoming");
  }

  @Post("requests")
  async sendRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendFriendRequestDto) {
    return this.friends.sendRequest(user.id, dto.username);
  }

  @Post("requests/:id/accept")
  async acceptRequest(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.friends.acceptRequest(user.id, id);
  }

  @Delete("requests/:id")
  async declineOrCancelRequest(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.friends.declineOrCancelRequest(user.id, id);
  }

  @Delete(":friendshipId")
  async removeFriend(@CurrentUser() user: AuthenticatedUser, @Param("friendshipId") friendshipId: string) {
    return this.friends.removeFriend(user.id, friendshipId);
  }
}
