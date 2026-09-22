import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
  ValidateNested,
} from "class-validator";
import type { BoosterCategory, CardCategory } from "@railcards/database";

export class CreateSeriesDto {
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() category!: CardCategory;
}

export class UpdateSeriesDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateCardDto {
  @IsString() @MinLength(2) @MaxLength(120) slug!: string;
  @IsUUID("4") seriesId!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() flavorText?: string;
  @IsString() category!: CardCategory;
  @IsUUID("4") rarityId!: string;
  @IsString() imageUrl!: string;
  @IsOptional() @IsIn(["DRAFT", "PUBLISHED", "ARCHIVED"]) status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export class CombatStatsDto {
  @IsInt() @Min(0) @Max(100) power!: number;
  @IsInt() @Min(0) @Max(100) reliability!: number;
  @IsInt() @Min(0) @Max(100) charm!: number;
}

export class UpdateCardDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() flavorText?: string;
  @IsOptional() @IsUUID("4") rarityId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() combatStatsEnabled?: boolean;
  @IsOptional()
  @ValidateNested()
  @Type(() => CombatStatsDto)
  combatStats?: CombatStatsDto;
}

export class CreateBoosterDefinitionDto {
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() description!: string;
  @IsString() category!: BoosterCategory;
  @IsInt() @Min(1) priceCr!: number;
  @IsInt() @Min(1) @Max(15) cardCount!: number;
  @IsString() imageUrl!: string;
}

export class PoolEntryDto {
  @IsUUID("4") rarityId!: string;
  @IsInt() @Min(1) weight!: number;
  @IsOptional() @IsUUID("4") seriesId?: string;
  @IsOptional() @IsUUID("4") cardDefinitionId?: string;
}

export class PublishPoolVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoolEntryDto)
  entries!: PoolEntryDto[];
}

export class CreateInvitationDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) maxUses?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) expiresInDays?: number;
}

export class ResolveReportDto {
  @IsIn(["RESOLVED", "DISMISSED"])
  status!: "RESOLVED" | "DISMISSED";
}

export class AdjustWalletDto {
  // Positive = credit, negative = debit. Debits are still guarded against
  // taking a wallet below zero (see WalletService.debit).
  @IsInt() @NotEquals(0) @Min(-1_000_000) @Max(1_000_000) amount!: number;
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
}
