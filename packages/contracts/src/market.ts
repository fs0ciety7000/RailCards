import { z } from "zod";

export const createListingSchema = z.object({
  cardInstanceId: z.string().uuid("Sélectionnez une carte"),
  priceCr: z.coerce.number().int().min(1, "Le prix doit être d'au moins 1 CR").max(1_000_000),
  listingType: z.enum(["FIXED", "AUCTION"]).optional(),
  durationHours: z.coerce.number().int().min(1).max(168).optional(),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const placeBidSchema = z.object({
  amountCr: z.coerce.number().int().min(1, "L'enchère doit être d'au moins 1 CR").max(1_000_000),
});
export type PlaceBidInput = z.infer<typeof placeBidSchema>;
