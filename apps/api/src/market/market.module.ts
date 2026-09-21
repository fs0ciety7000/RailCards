import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { MissionsModule } from "../missions/missions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MarketService } from "./market.service";
import { MarketController } from "./market.controller";

@Module({
  imports: [EconomyModule, MissionsModule, NotificationsModule],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
