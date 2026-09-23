import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CardVariantsService } from "./card-variants.service";
import { FoilifyDto } from "./dto/card-variants.dto";

@ApiTags("card-variants")
@ApiBearerAuth()
@Controller({ path: "card-variants", version: "1" })
export class CardVariantsController {
  constructor(private readonly cardVariants: CardVariantsService) {}

  @Get("foilable")
  async foilable(@CurrentUser() user: AuthenticatedUser) {
    return this.cardVariants.listFoilableGroups(user.id);
  }

  @Post("foilify")
  async foilify(@CurrentUser() user: AuthenticatedUser, @Body() dto: FoilifyDto) {
    return this.cardVariants.foilify(user.id, dto.cardInstanceIds);
  }
}
