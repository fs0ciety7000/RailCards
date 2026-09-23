import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ActivityService } from "./activity.service";

@ApiTags("activity")
@ApiBearerAuth()
@Controller({ path: "activity", version: "1" })
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  async feed(@Query("limit") limit = "30") {
    const l = Math.min(100, Math.max(1, Number(limit) || 30));
    return this.activity.getFeed(l);
  }
}
