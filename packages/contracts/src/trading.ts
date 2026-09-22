import { z } from "zod";

export const createTradeSchema = z
  .object({
    recipientUsername: z.string().min(3, "3 caractères minimum"),
    offeredCardInstanceIds: z.array(z.string().uuid()).max(20),
    requestedCardInstanceIds: z.array(z.string().uuid()).max(20),
    initiatorCr: z.coerce.number().int().min(0).max(1_000_000).optional(),
    recipientCr: z.coerce.number().int().min(0).max(1_000_000).optional(),
    message: z.string().max(500).optional(),
    expiresInHours: z.coerce.number().int().min(1).max(24 * 14).optional(),
  })
  .refine((v) => v.offeredCardInstanceIds.length > 0 || v.requestedCardInstanceIds.length > 0, {
    message: "Proposez au moins une carte ou un montant en CR",
    path: ["offeredCardInstanceIds"],
  });
export type CreateTradeInput = z.infer<typeof createTradeSchema>;

export const counterTradeSchema = z
  .object({
    offeredCardInstanceIds: z.array(z.string().uuid()).max(20),
    requestedCardInstanceIds: z.array(z.string().uuid()).max(20),
    initiatorCr: z.coerce.number().int().min(0).max(1_000_000).optional(),
    recipientCr: z.coerce.number().int().min(0).max(1_000_000).optional(),
    message: z.string().max(500).optional(),
    expiresInHours: z.coerce.number().int().min(1).max(24 * 14).optional(),
  })
  .refine((v) => v.offeredCardInstanceIds.length > 0 || v.requestedCardInstanceIds.length > 0, {
    message: "Proposez au moins une carte ou un montant en CR",
    path: ["offeredCardInstanceIds"],
  });
export type CounterTradeInput = z.infer<typeof counterTradeSchema>;

export const fileReportSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().min(3, "3 caractères minimum").max(200),
  details: z.string().max(2000).optional(),
});
export type FileReportInput = z.infer<typeof fileReportSchema>;
