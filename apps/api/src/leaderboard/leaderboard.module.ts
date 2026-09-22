import { Module } from "@nestjs/common";
import { GradesModule } from "../grades/grades.module";
import { LeaderboardService } from "./leaderboard.service";
import { LeaderboardController } from "./leaderboard.controller";

@Module({
  imports: [GradesModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
