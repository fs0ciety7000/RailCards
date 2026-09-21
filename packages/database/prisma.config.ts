import path from "node:path";
import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(__dirname, "../../.env") });

export default defineConfig({
  schema: path.join(__dirname, "../../prisma/schema.prisma"),
  migrations: {
    seed: "node ./node_modules/tsx/dist/cli.mjs ../../prisma/seed.ts",
  },
});
