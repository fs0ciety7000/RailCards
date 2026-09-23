import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ProfileTitlesService } from "./profile-titles.service";
import { SetActiveTitleDto } from "./dto/profile-title.dto";

@ApiTags("profile-titles")
@ApiBearerAuth()
@Controller({ path: "profile-titles", version: "1" })
export class ProfileTitlesController {
  constructor(private readonly profileTitles: ProfileTitlesService) {}

  @Get()
  async catalog() {
    return this.profileTitles.listCatalog();
  }

  @Get("mine")
  async mine(@CurrentUser() user: AuthenticatedUser) {
    return this.profileTitles.mine(user.id);
  }

  @Post("active")
  async setActive(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetActiveTitleDto) {
    return this.profileTitles.setActive(user.id, dto.titleId ?? null);
  }
}
