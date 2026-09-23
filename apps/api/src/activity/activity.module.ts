import { Module } from "@nestjs/common";
import { FriendsModule } from "../friends/friends.module";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";

@Module({
  imports: [FriendsModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
