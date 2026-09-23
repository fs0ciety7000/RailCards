import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CollectionModule } from "./collection/collection.module";
import { EconomyModule } from "./economy/economy.module";
import { BoostersModule } from "./boosters/boosters.module";
import { MissionsModule } from "./missions/missions.module";
import { TradingModule } from "./trading/trading.module";
import { MarketModule } from "./market/market.module";
import { AdminModule } from "./admin/admin.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SocialModule } from "./social/social.module";
import { StorageModule } from "./storage/storage.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";
import { GradesModule } from "./grades/grades.module";
import { CraftModule } from "./craft/craft.module";
import { DuelsModule } from "./duels/duels.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CollectionModule,
    EconomyModule,
    BoostersModule,
    MissionsModule,
    TradingModule,
    MarketModule,
    NotificationsModule,
    AdminModule,
    SocialModule,
    StorageModule,
    LeaderboardModule,
    GradesModule,
    CraftModule,
    DuelsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
