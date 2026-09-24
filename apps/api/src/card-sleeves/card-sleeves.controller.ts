import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CardSleevesService } from "./card-sleeves.service";
import { SetActiveSleeveDto } from "./dto/card-sleeve.dto";

@ApiTags("card-sleeves")
@ApiBearerAuth()
@Controller({ path: "card-sleeves", version: "1" })
export class CardSleevesController {
  constructor(private readonly cardSleeves: CardSleevesService) {}

  @Get()
  async catalog() {
    return this.cardSleeves.listCatalog();
  }

  @Get("mine")
  async mine(@CurrentUser() user: AuthenticatedUser) {
    return this.cardSleeves.mine(user.id);
  }

  @Post("active")
  async setActive(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetActiveSleeveDto) {
    return this.cardSleeves.setActive(user.id, dto.sleeveId ?? null);
  }
}
