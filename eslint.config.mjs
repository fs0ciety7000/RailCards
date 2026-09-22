// Shared flat ESLint config for the whole monorepo. Kept deliberately
// lightweight (recommended rules only, no type-aware linting) so it runs
// fast in CI; tighten it once the codebase has settled.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.generated.*",
      "apps/web/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Node-executed CJS config/setup scripts (jest configs, test bootstrap).
    files: ["**/*.cjs", "**/jest.*.js", "apps/api/test/utils/*.js", "scripts/**/*.js"],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // CLI scripts are expected to print to stdout.
    files: ["prisma/seed.ts", "prisma/seed-data/**/*.ts", "scripts/**/*.js"],
    rules: { "no-console": "off" },
  },
);
