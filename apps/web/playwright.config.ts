import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Must match WEB_BASE_URL in the API's .env (see apps/api/src/main.ts CORS
// config) — the API only accepts credentialed requests from that exact
// origin, so this can't be an arbitrary port. Don't run `pnpm dev` at the
// same time as this suite.
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Some sandboxed environments pre-install a specific Chromium revision
 * outside npm's usual browser cache (commonly at
 * PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers), and the exact revision
 * bundled by whatever @playwright/test version is installed doesn't
 * always match it. Resolve the binary dynamically (rather than hardcoding
 * a revision number) so this config stays portable; falls back to
 * Playwright's own default resolution (undefined) everywhere else,
 * including normal CI runs that do `npx playwright install`.
 */
function resolveSandboxChromiumPath(): string | undefined {
  const browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersDir || !existsSync(browsersDir)) return undefined;
  const revisionDir = readdirSync(browsersDir).find((name) => /^chromium-\d+$/.test(name));
  if (!revisionDir) return undefined;
  const binaryPath = join(browsersDir, revisionDir, "chrome-linux", "chrome");
  return existsSync(binaryPath) ? binaryPath : undefined;
}

const sandboxChromiumPath = resolveSandboxChromiumPath();

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        launchOptions: sandboxChromiumPath ? { executablePath: sandboxChromiumPath } : {},
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: sandboxChromiumPath ? { executablePath: sandboxChromiumPath } : {},
      },
    },
  ],
  // NEXT_PUBLIC_* vars are inlined at build time, not read by `next start` —
  // apps/web/.env.local already points at the API, which is what `pnpm build`
  // picks up. Run `pnpm --filter @railcards/web build` before this suite.
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: __dirname,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
