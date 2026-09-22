import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "3 caractères minimum")
  .max(20, "20 caractères maximum")
  .regex(/^[a-z0-9_]+$/i, "Lettres, chiffres et underscores uniquement");

export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(128)
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  username: usernameSchema,
  displayName: z.string().min(2).max(40),
  password: passwordSchema,
  invitationCode: z.string().min(1).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface AuthUserDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  createdAt: string;
}
