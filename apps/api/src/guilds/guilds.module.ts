import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { GradesModule } from "../grades/grades.module";
import { ActivityModule } from "../activity/activity.module";
import { EconomyModule } from "../economy/economy.module";
import { GuildsService } from "./guilds.service";
import { GuildChatService } from "./guild-chat.service";
import { GuildActivityService } from "./guild-activity.service";
import { GuildsController } from "./guilds.controller";

@Module({
  imports: [NotificationsModule, GradesModule, ActivityModule, EconomyModule],
  controllers: [GuildsController],
  providers: [GuildsService, GuildChatService, GuildActivityService],
  exports: [GuildsService],
})
export class GuildsModule {}
