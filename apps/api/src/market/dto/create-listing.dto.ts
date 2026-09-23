import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { GAME_CONSTANTS } from "@railcards/game-domain";

export class CreateListingDto {
  @IsUUID("4")
  cardInstanceId!: string;

  /** Buy-it-now price for a FIXED listing, or the starting price for an AUCTION. */
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  priceCr!: number;

  @IsOptional()
  @IsIn(["FIXED", "AUCTION"])
  listingType?: "FIXED" | "AUCTION";

  @IsOptional()
  @IsInt()
  @Min(GAME_CONSTANTS.AUCTION_MIN_DURATION_HOURS)
  @Max(GAME_CONSTANTS.AUCTION_MAX_DURATION_HOURS)
  durationHours?: number;
}

export class PlaceBidDto {
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amountCr!: number;
}
