import { Module } from "@nestjs/common";
import { ProfileTitlesService } from "./profile-titles.service";
import { ProfileTitlesController } from "./profile-titles.controller";

@Module({
  controllers: [ProfileTitlesController],
  providers: [ProfileTitlesService],
  exports: [ProfileTitlesService],
})
export class ProfileTitlesModule {}
