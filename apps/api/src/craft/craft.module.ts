import { Module } from "@nestjs/common";
import { MissionsModule } from "../missions/missions.module";
import { CraftService } from "./craft.service";
import { CraftController } from "./craft.controller";

@Module({
  imports: [MissionsModule],
  controllers: [CraftController],
  providers: [CraftService],
  exports: [CraftService],
})
export class CraftModule {}
