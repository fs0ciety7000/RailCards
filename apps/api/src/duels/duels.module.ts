import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DuelsService } from "./duels.service";
import { DuelsController } from "./duels.controller";

@Module({
  imports: [EconomyModule, NotificationsModule],
  controllers: [DuelsController],
  providers: [DuelsService],
  exports: [DuelsService],
})
export class DuelsModule {}
