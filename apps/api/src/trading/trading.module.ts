import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { MissionsModule } from "../missions/missions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TradingService } from "./trading.service";
import { TradingController } from "./trading.controller";

@Module({
  imports: [EconomyModule, MissionsModule, NotificationsModule],
  controllers: [TradingController],
  providers: [TradingService],
  exports: [TradingService],
})
export class TradingModule {}
