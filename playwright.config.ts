import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_DATABASE_URL, E2E_PORT as port } from "./tests/e2e/support/constants";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    locale: "de-DE",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Recreates and seeds the disposable database, then starts the app against it.
    command:
      "pnpm exec tsx --import ./scripts/lib/server-only-shim.mjs tests/e2e/support/prepare-db.ts && pnpm dev",
    url: `http://localhost:${port}/api/health`,
    // Never silently test another worktree's server.
    reuseExistingServer: false,
    env: {
      PORT: port,
      APP_URL: `http://localhost:${port}`,
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: E2E_AUTH_SECRET,
      MAIL_TRANSPORT: "memory",
      LOG_LEVEL: "warn",
    },
    timeout: 240_000,
  },
});
