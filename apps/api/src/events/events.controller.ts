import { Controller, Get, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { EventsService } from "./events.service";

@ApiTags("events")
@ApiBearerAuth()
@Controller({ path: "events", version: "1" })
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // Raw @Res() so "no active event" serializes as a literal JSON `null`
  // instead of NestJS silently swallowing it into an empty body — see
  // GuildsController.mine for the same fix.
  @Get("active")
  async active(@Res() res: Response) {
    const event = await this.events.getActive();
    res.json(event);
  }
}
