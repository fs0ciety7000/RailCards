import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { GAME_CONSTANTS } from "@railcards/game-domain";

export class CreateGuildDto {
  @IsString()
  @MinLength(GAME_CONSTANTS.GUILD_NAME_MIN_LENGTH)
  @MaxLength(GAME_CONSTANTS.GUILD_NAME_MAX_LENGTH)
  name!: string;

  @IsString()
  @MinLength(GAME_CONSTANTS.GUILD_TAG_MIN_LENGTH)
  @MaxLength(GAME_CONSTANTS.GUILD_TAG_MAX_LENGTH)
  @Matches(/^[A-Za-z0-9]+$/, { message: "Le tag ne peut contenir que des lettres et des chiffres" })
  tag!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
