import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { MissionsModule } from "../missions/missions.module";
import { BoostersService } from "./boosters.service";
import { BoostersController } from "./boosters.controller";

@Module({
  imports: [EconomyModule, MissionsModule],
  controllers: [BoostersController],
  providers: [BoostersService],
  exports: [BoostersService],
})
export class BoostersModule {}
