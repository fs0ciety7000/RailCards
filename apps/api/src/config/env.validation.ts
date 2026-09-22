import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  WEB_BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  COOKIE_SECRET: z.string().min(16),
  INVITE_ONLY_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  TRADE_CR_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  MARKET_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(500),
  LOCAL_STORAGE_DIR: z.string().default("storage/uploads"),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().min(1).max(25).default(5),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.toString()}`);
  }
  return result.data;
}
