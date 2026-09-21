import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { MissionsService } from "./missions.service";
import { MissionsController } from "./missions.controller";

@Module({
  imports: [EconomyModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
