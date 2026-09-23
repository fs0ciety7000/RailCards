import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { GradesModule } from "../grades/grades.module";
import { GuildsService } from "./guilds.service";
import { GuildChatService } from "./guild-chat.service";
import { GuildsController } from "./guilds.controller";

@Module({
  imports: [NotificationsModule, GradesModule],
  controllers: [GuildsController],
  providers: [GuildsService, GuildChatService],
  exports: [GuildsService],
})
export class GuildsModule {}
