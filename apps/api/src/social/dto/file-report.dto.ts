import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class FileReportDto {
  @IsUUID("4")
  targetUserId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
