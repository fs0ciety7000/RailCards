import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from "class-validator";

export class CreateTradeDto {
  @IsString()
  @MinLength(3)
  recipientUsername!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  offeredCardInstanceIds!: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  requestedCardInstanceIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  initiatorCr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  recipientCr?: number;

  @IsOptional()
  @IsString()
  @MinLength(0)
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 14)
  expiresInHours?: number;
}

export class CounterTradeDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  offeredCardInstanceIds!: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  requestedCardInstanceIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  initiatorCr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  recipientCr?: number;

  @IsOptional()
  @IsString()
  @MinLength(0)
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 14)
  expiresInHours?: number;
}

export class ListTradesQueryDto {
  @IsOptional()
  @IsIn(["sent", "received", "all"])
  direction?: "sent" | "received" | "all";

  @IsOptional()
  @IsString()
  status?: string;
}
