import { PrismaClient } from "@prisma/client";

declare global {
   
  var __railcardsPrisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse a single instance across hot reloads / module reloads in dev.
export const prisma: PrismaClient = globalThis.__railcardsPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__railcardsPrisma = prisma;
}

export * from "@prisma/client";
