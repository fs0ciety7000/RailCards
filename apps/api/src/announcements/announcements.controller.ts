import { Controller, Get, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import { AnnouncementsService } from "./announcements.service";

@ApiTags("announcements")
@Controller({ path: "announcement", version: "1" })
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  // Public so it can be read before login completes if ever needed later.
  //
  // Raw @Res() so "no active announcement" serializes as a literal JSON
  // `null` instead of NestJS silently swallowing it into an empty body —
  // see GuildsController.mine / QuestsController.active for the same fix.
  @Public()
  @Get("active")
  async active(@Res() res: Response) {
    const announcement = await this.announcements.getActive();
    res.json(announcement);
  }
}
