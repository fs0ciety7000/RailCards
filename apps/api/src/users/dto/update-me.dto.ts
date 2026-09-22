import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateMeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) displayName?: string;
  @IsOptional() @IsString() @MaxLength(280) bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
}
