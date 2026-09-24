import { z } from "zod";

export const cardCategorySchema = z.enum([
  "ROLLING_STOCK",
  "STATION_PLACE",
  "PROFESSION",
  "DAILY_LIFE_HUMOR",
  "SPECIAL_EDITION",
]);
export type CardCategory = z.infer<typeof cardCategorySchema>;

export const boosterCategorySchema = z.enum(["DISCOVERY", "CLASSIC", "THEMED"]);
export type BoosterCategoryInput = z.infer<typeof boosterCategorySchema>;

export const createSeriesSchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  category: cardCategorySchema,
  coverImageUrl: z.string().optional(),
});
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;

export const updateSeriesSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;

export const createCardSchema = z.object({
  slug: z.string().min(2).max(120),
  seriesId: z.string().uuid("Sélectionnez une série"),
  name: z.string().min(2).max(120),
  description: z.string().min(1, "Description requise"),
  flavorText: z.string().optional(),
  category: cardCategorySchema,
  rarityId: z.string().uuid("Sélectionnez une rareté"),
  imageUrl: z.string().min(1, "URL d'image requise"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});
export type CreateCardInput = z.infer<typeof createCardSchema>;

export const combatStatsSchema = z.object({
  power: z.coerce.number().int().min(0).max(100),
  reliability: z.coerce.number().int().min(0).max(100),
  charm: z.coerce.number().int().min(0).max(100),
});
export type CombatStatsInput = z.infer<typeof combatStatsSchema>;

export const updateCardSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().optional(),
  flavorText: z.string().optional(),
  seriesId: z.string().uuid().optional(),
  rarityId: z.string().uuid().optional(),
  imageUrl: z.string().optional(),
  combatStatsEnabled: z.boolean().optional(),
  combatStats: combatStatsSchema.optional(),
});
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const createBoosterDefinitionSchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  description: z.string().min(1),
  category: boosterCategorySchema,
  priceCr: z.coerce.number().int().min(1),
  cardCount: z.coerce.number().int().min(1).max(15),
  imageUrl: z.string().min(1),
});
export type CreateBoosterDefinitionInput = z.infer<typeof createBoosterDefinitionSchema>;

export const updateBoosterDefinitionSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().min(1).optional(),
  category: boosterCategorySchema.optional(),
  priceCr: z.coerce.number().int().min(1).optional(),
  cardCount: z.coerce.number().int().min(1).max(15).optional(),
  imageUrl: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBoosterDefinitionInput = z.infer<typeof updateBoosterDefinitionSchema>;

export const poolEntrySchema = z.object({
  rarityId: z.string().uuid(),
  weight: z.coerce.number().int().min(1),
  category: cardCategorySchema.optional().or(z.literal("")),
  seriesId: z.string().uuid().optional().or(z.literal("")),
  cardDefinitionId: z.string().uuid().optional().or(z.literal("")),
});
export type PoolEntryInput = z.infer<typeof poolEntrySchema>;

export const publishPoolVersionSchema = z.object({
  entries: z.array(poolEntrySchema).min(1, "Ajoutez au moins une entrée"),
});
export type PublishPoolVersionInput = z.infer<typeof publishPoolVersionSchema>;

export const createInvitationSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  maxUses: z.coerce.number().int().min(1).max(10000).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const resolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

export const adjustWalletSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((v) => v !== 0, "Le montant ne peut pas être nul"),
  reason: z.string().max(280).optional().or(z.literal("")),
});
export type AdjustWalletInput = z.infer<typeof adjustWalletSchema>;

export const grantCardSchema = z.object({
  cardDefinitionId: z.string().uuid("Sélectionnez une carte"),
  quantity: z.coerce.number().int().min(1).max(50).optional(),
});
export type GrantCardInput = z.infer<typeof grantCardSchema>;

export const mintSignatureCardSchema = z.object({
  cardDefinitionId: z.string().uuid("Sélectionnez une carte"),
  editionSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type MintSignatureCardInput = z.infer<typeof mintSignatureCardSchema>;

export const missionGoalTypeSchema = z.enum([
  "OPEN_BOOSTER",
  "COLLECT_UNIQUE_CARDS",
  "COMPLETE_TRADE",
  "SELL_ON_MARKET",
  "BUY_ON_MARKET",
  "LOGIN",
  "COMPLETE_SERIES",
]);
export type MissionGoalTypeInput = z.infer<typeof missionGoalTypeSchema>;

const missionBaseFields = {
  title: z.string().min(2).max(120),
  description: z.string().min(1),
  goalType: missionGoalTypeSchema,
  goalCount: z.coerce.number().int().min(1),
  rewardCr: z.coerce.number().int().min(0).optional(),
  rewardXp: z.coerce.number().int().min(0).optional(),
};

export const createMissionSchema = z.object({
  code: z.string().min(2).max(80),
  ...missionBaseFields,
  resetPeriod: z.enum(["NONE", "DAILY"]).optional(),
});
export type CreateMissionInput = z.infer<typeof createMissionSchema>;

export const updateMissionSchema = z.object({
  ...missionBaseFields,
  title: missionBaseFields.title.optional(),
  description: missionBaseFields.description.optional(),
  goalType: missionBaseFields.goalType.optional(),
  goalCount: missionBaseFields.goalCount.optional(),
  resetPeriod: z.enum(["NONE", "DAILY"]).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;

export const createAchievementSchema = z.object({
  code: z.string().min(2).max(80),
  ...missionBaseFields,
  rewardBannerId: z.string().uuid().optional().or(z.literal("")),
  rewardTitleId: z.string().uuid().optional().or(z.literal("")),
});
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>;

export const updateAchievementSchema = z.object({
  ...missionBaseFields,
  title: missionBaseFields.title.optional(),
  description: missionBaseFields.description.optional(),
  goalType: missionBaseFields.goalType.optional(),
  goalCount: missionBaseFields.goalCount.optional(),
  rewardBannerId: z.string().uuid().optional().or(z.literal("")),
  rewardTitleId: z.string().uuid().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
export type UpdateAchievementInput = z.infer<typeof updateAchievementSchema>;

export const createProfileBannerSchema = z.object({
  slug: z.string().min(2).max(60),
  name: z.string().min(2).max(60),
  colorFrom: z.string().min(3).max(20),
  colorTo: z.string().min(3).max(20),
  icon: z.string().min(1).max(40),
});
export type CreateProfileBannerInput = z.infer<typeof createProfileBannerSchema>;

export const createProfileTitleSchema = z.object({
  slug: z.string().min(2).max(60),
  label: z.string().min(2).max(80),
});
export type CreateProfileTitleInput = z.infer<typeof createProfileTitleSchema>;

export const questStepSchema = z.object({
  order: z.coerce.number().int().min(1),
  title: z.string().min(2).max(120),
  narrative: z.string().min(1),
  goalType: missionGoalTypeSchema,
  goalCount: z.coerce.number().int().min(1),
  rewardCr: z.coerce.number().int().min(0).optional(),
  rewardXp: z.coerce.number().int().min(0).optional(),
});

export const createQuestSchema = z.object({
  slug: z.string().min(2).max(80),
  title: z.string().min(2).max(120),
  description: z.string().min(1),
  steps: z.array(questStepSchema).min(1, "Ajoutez au moins une étape"),
});
export type CreateQuestInput = z.infer<typeof createQuestSchema>;

export const createGradeSchema = z.object({
  minLevel: z.coerce.number().int().min(1).max(1000),
  title: z.string().min(1).max(80),
});
export type CreateGradeInput = z.infer<typeof createGradeSchema>;

export const updateGradeSchema = z.object({
  minLevel: z.coerce.number().int().min(1).max(1000).optional(),
  title: z.string().min(1).max(80).optional(),
});
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
