import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { GradesModule } from "../grades/grades.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MissionsService } from "./missions.service";
import { MissionsController } from "./missions.controller";

@Module({
  imports: [EconomyModule, GradesModule, NotificationsModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
