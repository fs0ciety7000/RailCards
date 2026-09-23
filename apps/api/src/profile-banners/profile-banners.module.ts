import { Module } from "@nestjs/common";
import { ProfileBannersService } from "./profile-banners.service";
import { ProfileBannersController } from "./profile-banners.controller";

@Module({
  controllers: [ProfileBannersController],
  providers: [ProfileBannersService],
  exports: [ProfileBannersService],
})
export class ProfileBannersModule {}
