import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
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
import type { BoosterCategory, CardCategory, MissionGoalType, MissionResetPeriod } from "@railcards/database";

export class CreateSeriesDto {
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() category!: CardCategory;
  @IsOptional() @IsString() coverImageUrl?: string;
}

export class UpdateSeriesDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() coverImageUrl?: string;
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
  @IsOptional() @IsUUID("4") seriesId?: string;
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

export class UpdateBoosterDefinitionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: BoosterCategory;
  @IsOptional() @IsInt() @Min(1) priceCr?: number;
  @IsOptional() @IsInt() @Min(1) @Max(15) cardCount?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PoolEntryDto {
  @IsUUID("4") rarityId!: string;
  @IsInt() @Min(1) weight!: number;
  @IsOptional() @IsString() category?: CardCategory;
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

export class GrantCardDto {
  @IsUUID("4") cardDefinitionId!: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) quantity?: number;
}

const MISSION_GOAL_TYPES = [
  "OPEN_BOOSTER",
  "COLLECT_UNIQUE_CARDS",
  "COMPLETE_TRADE",
  "SELL_ON_MARKET",
  "BUY_ON_MARKET",
  "LOGIN",
  "COMPLETE_SERIES",
];

export class CreateMissionDto {
  @IsString() @MinLength(2) @MaxLength(80) code!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() description!: string;
  @IsIn(MISSION_GOAL_TYPES) goalType!: MissionGoalType;
  @IsInt() @Min(1) goalCount!: number;
  @IsOptional() @IsInt() @Min(0) rewardCr?: number;
  @IsOptional() @IsInt() @Min(0) rewardXp?: number;
  @IsOptional() @IsIn(["NONE", "DAILY"]) resetPeriod?: MissionResetPeriod;
}

export class UpdateMissionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(MISSION_GOAL_TYPES) goalType?: MissionGoalType;
  @IsOptional() @IsInt() @Min(1) goalCount?: number;
  @IsOptional() @IsInt() @Min(0) rewardCr?: number;
  @IsOptional() @IsInt() @Min(0) rewardXp?: number;
  @IsOptional() @IsIn(["NONE", "DAILY"]) resetPeriod?: MissionResetPeriod;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateAchievementDto {
  @IsString() @MinLength(2) @MaxLength(80) code!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() description!: string;
  @IsIn(MISSION_GOAL_TYPES) goalType!: MissionGoalType;
  @IsInt() @Min(1) goalCount!: number;
  @IsOptional() @IsInt() @Min(0) rewardCr?: number;
  @IsOptional() @IsInt() @Min(0) rewardXp?: number;
}

export class UpdateAchievementDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(MISSION_GOAL_TYPES) goalType?: MissionGoalType;
  @IsOptional() @IsInt() @Min(1) goalCount?: number;
  @IsOptional() @IsInt() @Min(0) rewardCr?: number;
  @IsOptional() @IsInt() @Min(0) rewardXp?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateQuestStepDto {
  @IsInt() @Min(1) order!: number;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(1) narrative!: string;
  @IsIn(MISSION_GOAL_TYPES) goalType!: MissionGoalType;
  @IsInt() @Min(1) goalCount!: number;
  @IsOptional() @IsInt() @Min(0) rewardCr?: number;
  @IsOptional() @IsInt() @Min(0) rewardXp?: number;
}

export class CreateQuestDto {
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() description!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestStepDto)
  steps!: CreateQuestStepDto[];
}

export class UpsertAnnouncementDto {
  @IsString() @MinLength(1) @MaxLength(500) message!: string;
  @IsBoolean() isActive!: boolean;
}

export class CreateEventDto {
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(1) description!: string;
  @IsOptional() @IsString() bannerImageUrl?: string;
  @Type(() => Date) @IsDate() startsAt!: Date;
  @Type(() => Date) @IsDate() endsAt!: Date;
  @IsOptional() @IsInt() @Min(10_000) @Max(100_000) xpMultiplierBps?: number;
}

export class UpdateEventDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MinLength(1) description?: string;
  @IsOptional() @IsString() bannerImageUrl?: string;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
  @IsOptional() @IsInt() @Min(10_000) @Max(100_000) xpMultiplierBps?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StartSeasonDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
}

export class CreateGradeDto {
  @IsInt() @Min(1) @Max(1000) minLevel!: number;
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
}

export class UpdateGradeDto {
  @IsOptional() @IsInt() @Min(1) @Max(1000) minLevel?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) title?: string;
}
