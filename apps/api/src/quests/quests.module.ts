import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { GradesModule } from "../grades/grades.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EventsModule } from "../events/events.module";
import { SeasonsModule } from "../seasons/seasons.module";
import { GuildWarsModule } from "../guild-wars/guild-wars.module";
import { GuildsModule } from "../guilds/guilds.module";
import { QuestsService } from "./quests.service";
import { QuestsController } from "./quests.controller";

@Module({
  imports: [EconomyModule, GradesModule, NotificationsModule, EventsModule, SeasonsModule, GuildWarsModule, GuildsModule],
  controllers: [QuestsController],
  providers: [QuestsService],
  exports: [QuestsService],
})
export class QuestsModule {}
