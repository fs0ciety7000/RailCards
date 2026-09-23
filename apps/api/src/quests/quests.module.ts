import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { GradesModule } from "../grades/grades.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { QuestsService } from "./quests.service";
import { QuestsController } from "./quests.controller";

@Module({
  imports: [EconomyModule, GradesModule, NotificationsModule],
  controllers: [QuestsController],
  providers: [QuestsService],
  exports: [QuestsService],
})
export class QuestsModule {}
