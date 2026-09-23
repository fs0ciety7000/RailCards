import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SeasonsModule } from "../seasons/seasons.module";
import { GradesModule } from "../grades/grades.module";
import { SeasonPassService } from "./season-pass.service";
import { SeasonPassController } from "./season-pass.controller";

@Module({
  imports: [EconomyModule, NotificationsModule, SeasonsModule, GradesModule],
  controllers: [SeasonPassController],
  providers: [SeasonPassService],
  exports: [SeasonPassService],
})
export class SeasonPassModule {}
