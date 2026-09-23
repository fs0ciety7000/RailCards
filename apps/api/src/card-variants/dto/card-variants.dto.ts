import { ArrayMaxSize, ArrayMinSize, IsUUID } from "class-validator";
import { GAME_CONSTANTS } from "@railcards/game-domain";

export class FoilifyDto {
  @IsUUID("4", { each: true })
  @ArrayMinSize(GAME_CONSTANTS.CARD_FOIL_RECIPE_SIZE)
  @ArrayMaxSize(GAME_CONSTANTS.CARD_FOIL_RECIPE_SIZE)
  cardInstanceIds!: string[];
}
