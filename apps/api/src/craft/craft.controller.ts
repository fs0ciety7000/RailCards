import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CraftService } from "./craft.service";
import { CraftDto } from "./craft.dto";

@ApiTags("craft")
@ApiBearerAuth()
@Controller({ path: "craft", version: "1" })
export class CraftController {
  constructor(private readonly craft: CraftService) {}

  @Get("craftable")
  async craftable(@CurrentUser() user: AuthenticatedUser) {
    return this.craft.listCraftableGroups(user.id);
  }

  @Post()
  async craftCard(@CurrentUser() user: AuthenticatedUser, @Body() dto: CraftDto) {
    return this.craft.craft(user.id, dto.cardInstanceIds);
  }
}
