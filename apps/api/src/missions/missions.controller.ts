import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MissionsService } from "./missions.service";

@ApiTags("missions")
@ApiBearerAuth()
@Controller({ version: "1" })
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get("missions")
  async missionsList(@CurrentUser() user: AuthenticatedUser) {
    return this.missions.listMissions(user.id);
  }

  @Post("missions/:userMissionId/claim")
  async claimMission(@CurrentUser() user: AuthenticatedUser, @Param("userMissionId") userMissionId: string) {
    return this.missions.claimMission(user.id, userMissionId);
  }

  @Get("achievements")
  async achievementsList(@CurrentUser() user: AuthenticatedUser) {
    return this.missions.listAchievements(user.id);
  }

  @Post("achievements/:achievementId/claim")
  async claimAchievement(@CurrentUser() user: AuthenticatedUser, @Param("achievementId") achievementId: string) {
    return this.missions.claimAchievement(user.id, achievementId);
  }
}
