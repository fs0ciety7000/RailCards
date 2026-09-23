import { Module } from "@nestjs/common";
import { GradesModule } from "../grades/grades.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WalletService } from "./wallet.service";
import { DailyRewardService } from "./daily-reward.service";
import { EconomyController } from "./economy.controller";

@Module({
  imports: [GradesModule, NotificationsModule],
  controllers: [EconomyController],
  providers: [WalletService, DailyRewardService],
  exports: [WalletService],
})
export class EconomyModule {}
