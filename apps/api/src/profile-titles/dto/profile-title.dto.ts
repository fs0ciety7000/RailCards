import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SetActiveTitleDto {
  @IsOptional() @IsUUID() titleId?: string | null;
}

export class CreateProfileTitleDto {
  @IsString() @MinLength(2) @MaxLength(60) slug!: string;
  @IsString() @MinLength(2) @MaxLength(80) label!: string;
}
