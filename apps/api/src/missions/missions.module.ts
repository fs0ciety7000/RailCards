import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { GradesModule } from "../grades/grades.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EventsModule } from "../events/events.module";
import { SeasonsModule } from "../seasons/seasons.module";
import { GuildWarsModule } from "../guild-wars/guild-wars.module";
import { GuildsModule } from "../guilds/guilds.module";
import { ProfileBannersModule } from "../profile-banners/profile-banners.module";
import { MissionsService } from "./missions.service";
import { MissionsController } from "./missions.controller";

@Module({
  imports: [EconomyModule, GradesModule, NotificationsModule, EventsModule, SeasonsModule, GuildWarsModule, GuildsModule, ProfileBannersModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
