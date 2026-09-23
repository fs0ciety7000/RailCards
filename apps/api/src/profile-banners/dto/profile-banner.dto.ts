import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SetActiveBannerDto {
  @IsOptional() @IsUUID() bannerId?: string | null;
}

export class CreateProfileBannerDto {
  @IsString() @MinLength(2) @MaxLength(60) slug!: string;
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsString() @MinLength(3) @MaxLength(20) colorFrom!: string;
  @IsString() @MinLength(3) @MaxLength(20) colorTo!: string;
  @IsString() @MinLength(1) @MaxLength(40) icon!: string;
}
