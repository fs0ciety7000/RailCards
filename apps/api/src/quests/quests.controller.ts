import { Controller, Get, Param, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { QuestsService } from "./quests.service";

@ApiTags("quests")
@ApiBearerAuth()
@Controller({ path: "quests", version: "1" })
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  // NestJS treats a returned `null` the same as `undefined` and sends an
  // empty body instead of JSON "null" — breaking a `Quest | null` contract.
  // A raw @Res() bypasses the automatic response handling that does this.
  @Get("active")
  async active(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const quest = await this.quests.getActiveQuest(user.id);
    res.json(quest);
  }

  @Post("steps/:stepId/claim")
  async claim(@CurrentUser() user: AuthenticatedUser, @Param("stepId") stepId: string) {
    return this.quests.claimStep(user.id, stepId);
  }
}
