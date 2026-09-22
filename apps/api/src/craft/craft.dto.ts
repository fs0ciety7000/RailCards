import { ArrayMaxSize, ArrayMinSize, IsUUID } from "class-validator";
import { GAME_CONSTANTS } from "@railcards/game-domain";

export class CraftDto {
  @IsUUID("4", { each: true })
  @ArrayMinSize(GAME_CONSTANTS.CRAFT_RECIPE_SIZE)
  @ArrayMaxSize(GAME_CONSTANTS.CRAFT_RECIPE_SIZE)
  cardInstanceIds!: string[];
}
