import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SocialController } from "./social.controller";

@Module({
  imports: [AdminModule],
  controllers: [SocialController],
})
export class SocialModule {}
