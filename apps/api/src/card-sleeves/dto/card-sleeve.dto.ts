import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SetActiveSleeveDto {
  @IsOptional() @IsUUID() sleeveId?: string | null;
}

export class CreateCardSleeveDto {
  @IsString() @MinLength(2) @MaxLength(60) slug!: string;
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsString() @MinLength(3) @MaxLength(20) colorFrom!: string;
  @IsString() @MinLength(3) @MaxLength(20) colorTo!: string;
  @IsString() @MinLength(1) @MaxLength(40) pattern!: string;
}
