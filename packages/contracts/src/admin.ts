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
});
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;

export const updateSeriesSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().optional(),
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

export const updateCardSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().optional(),
  flavorText: z.string().optional(),
  rarityId: z.string().uuid().optional(),
  imageUrl: z.string().optional(),
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

export const poolEntrySchema = z.object({
  rarityId: z.string().uuid(),
  weight: z.coerce.number().int().min(1),
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
