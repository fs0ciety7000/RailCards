import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { GuildWarsService } from "./guild-wars.service";
import { GuildWarsController } from "./guild-wars.controller";

@Module({
  imports: [EconomyModule, NotificationsModule],
  controllers: [GuildWarsController],
  providers: [GuildWarsService],
  exports: [GuildWarsService],
})
export class GuildWarsModule {}
