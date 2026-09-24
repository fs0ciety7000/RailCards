import { Module } from "@nestjs/common";
import { GradesModule } from "../grades/grades.module";
import { FriendsModule } from "../friends/friends.module";
import { LeaderboardService } from "./leaderboard.service";
import { LeaderboardController } from "./leaderboard.controller";

@Module({
  imports: [GradesModule, FriendsModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
