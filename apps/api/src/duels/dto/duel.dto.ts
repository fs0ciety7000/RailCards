import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { GAME_CONSTANTS } from "@railcards/game-domain";

export class CreateDuelDto {
  @IsString()
  @MinLength(3)
  opponentUsername!: string;

  @IsUUID("4")
  cardInstanceId!: string;

  @IsInt()
  @Min(GAME_CONSTANTS.DUEL_MIN_WAGER_CR)
  @Max(GAME_CONSTANTS.DUEL_MAX_WAGER_CR)
  wagerCr!: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}

export class AcceptDuelDto {
  @IsUUID("4")
  cardInstanceId!: string;
}
