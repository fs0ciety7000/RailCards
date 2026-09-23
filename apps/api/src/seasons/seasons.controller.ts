import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { SeasonsService } from "./seasons.service";

@ApiTags("seasons")
@ApiBearerAuth()
@Controller({ path: "seasons", version: "1" })
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  // Raw @Res() so "no active season" serializes as a literal JSON `null`
  // instead of NestJS silently swallowing it into an empty body — see
  // GuildsController.mine for the same fix.
  @Get("active")
  async active(@Res() res: Response) {
    const season = await this.seasons.getActive();
    res.json(season);
  }

  @Get("leaderboard")
  async leaderboard(@Query("limit") limit = "50") {
    return this.seasons.leaderboard(Math.min(200, Math.max(1, Number(limit) || 50)));
  }
}
