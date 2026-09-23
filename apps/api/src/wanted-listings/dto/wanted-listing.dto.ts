import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateWantedListingDto {
  @IsUUID("4")
  cardDefinitionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
