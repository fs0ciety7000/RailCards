import { Module } from "@nestjs/common";
import { CollectionModule } from "../collection/collection.module";
import { StorageModule } from "../storage/storage.module";
import { GradesModule } from "../grades/grades.module";
import { ProfileBannersModule } from "../profile-banners/profile-banners.module";
import { ProfileTitlesModule } from "../profile-titles/profile-titles.module";
import { CardSleevesModule } from "../card-sleeves/card-sleeves.module";
import { MissionsModule } from "../missions/missions.module";
import { DuelsModule } from "../duels/duels.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { FavoritesService } from "./favorites.service";

@Module({
  imports: [
    CollectionModule,
    StorageModule,
    GradesModule,
    ProfileBannersModule,
    ProfileTitlesModule,
    CardSleevesModule,
    MissionsModule,
    DuelsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, FavoritesService],
  exports: [UsersService],
})
export class UsersModule {}
