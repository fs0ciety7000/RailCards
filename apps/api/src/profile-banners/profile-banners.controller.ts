import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ProfileBannersService } from "./profile-banners.service";
import { SetActiveBannerDto } from "./dto/profile-banner.dto";

@ApiTags("profile-banners")
@ApiBearerAuth()
@Controller({ path: "profile-banners", version: "1" })
export class ProfileBannersController {
  constructor(private readonly profileBanners: ProfileBannersService) {}

  @Get()
  async catalog() {
    return this.profileBanners.listCatalog();
  }

  @Get("mine")
  async mine(@CurrentUser() user: AuthenticatedUser) {
    return this.profileBanners.mine(user.id);
  }

  @Post("active")
  async setActive(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetActiveBannerDto) {
    return this.profileBanners.setActive(user.id, dto.bannerId ?? null);
  }
}
