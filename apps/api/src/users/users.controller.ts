import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { UsersService } from "./users.service";

// Note: RailCards is invite-gated end to end, so even "public" player
// profiles require an authenticated session — there is no anonymous
// browsing surface. @Public() is intentionally not used here.
@ApiTags("users")
@ApiBearerAuth()
@Controller({ version: "1" })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Get("users/:username")
  async publicProfile(@Param("username") username: string) {
    return this.usersService.getPublicProfile(username);
  }

  @Get("users/:username/collection")
  async publicCollection(
    @Param("username") username: string,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "24",
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 24));
    return this.usersService.getPublicCollection(username, p, ps);
  }
}
