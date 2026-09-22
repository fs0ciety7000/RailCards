import { z } from "zod";

export const updateMeSchema = z.object({
  displayName: z.string().min(2).max(40).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().optional(),
  isPublic: z.boolean().optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
