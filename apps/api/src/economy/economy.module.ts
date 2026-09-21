import { Module } from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { DailyRewardService } from "./daily-reward.service";
import { EconomyController } from "./economy.controller";

@Module({
  controllers: [EconomyController],
  providers: [WalletService, DailyRewardService],
  exports: [WalletService],
})
export class EconomyModule {}
