import { ApiError } from "./api";

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Une erreur inconnue est survenue.";
}
