import { IsInt, IsUUID, Max, Min } from "class-validator";

export class CreateListingDto {
  @IsUUID("4")
  cardInstanceId!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  priceCr!: number;
}
