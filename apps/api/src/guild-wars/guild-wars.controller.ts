import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { GuildWarsService } from "./guild-wars.service";

@ApiTags("guild-wars")
@ApiBearerAuth()
@Controller({ path: "guild-wars", version: "1" })
export class GuildWarsController {
  constructor(private readonly guildWars: GuildWarsService) {}

  // Raw @Res() so "no active period" serializes as a literal JSON `null`
  // instead of NestJS silently swallowing it into an empty body — same fix
  // as SeasonsController.active.
  @Get("active")
  async active(@Res() res: Response) {
    const period = await this.guildWars.getActive();
    res.json(period);
  }

  @Get("leaderboard")
  async leaderboard(@Query("limit") limit = "50") {
    return this.guildWars.leaderboard(Math.min(200, Math.max(1, Number(limit) || 50)));
  }
}
