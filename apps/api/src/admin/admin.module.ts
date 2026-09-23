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
import { AnnouncementsModule } from "../announcements/announcements.module";
import { EventsModule } from "../events/events.module";
import { SeasonsModule } from "../seasons/seasons.module";
import { GuildWarsModule } from "../guild-wars/guild-wars.module";
import { SeasonPassModule } from "../season-pass/season-pass.module";
import { AdminController } from "./admin.controller";
import { AdminUsersService } from "./admin-users.service";
import { InvitationsService } from "./invitations.service";
import { ReportsService } from "./reports.service";
import { AuditLogService } from "./audit-log.service";

@Module({
  imports: [
    CatalogModule,
    BoostersModule,
    EconomyModule,
    StorageModule,
    MissionsModule,
    GradesModule,
    NotificationsModule,
    GuildsModule,
    QuestsModule,
    AnnouncementsModule,
    EventsModule,
    SeasonsModule,
    GuildWarsModule,
    SeasonPassModule,
  ],
  controllers: [AdminController],
  providers: [AdminUsersService, InvitationsService, ReportsService, AuditLogService],
  exports: [InvitationsService, ReportsService],
})
export class AdminModule {}
