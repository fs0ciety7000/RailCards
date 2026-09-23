import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { BoostersModule } from "../boosters/boosters.module";
import { EconomyModule } from "../economy/economy.module";
import { StorageModule } from "../storage/storage.module";
import { MissionsModule } from "../missions/missions.module";
import { GradesModule } from "../grades/grades.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { GuildsModule } from "../guilds/guilds.module";
import { QuestsModule } from "../quests/quests.module";
import { AdminController } from "./admin.controller";
import { AdminUsersService } from "./admin-users.service";
import { InvitationsService } from "./invitations.service";
import { ReportsService } from "./reports.service";
import { AuditLogService } from "./audit-log.service";

@Module({
  imports: [CatalogModule, BoostersModule, EconomyModule, StorageModule, MissionsModule, GradesModule, NotificationsModule, GuildsModule, QuestsModule],
  controllers: [AdminController],
  providers: [AdminUsersService, InvitationsService, ReportsService, AuditLogService],
  exports: [InvitationsService, ReportsService],
})
export class AdminModule {}
