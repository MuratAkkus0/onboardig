import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${port}/api/health`,
    // Never silently test another worktree's server.
    reuseExistingServer: false,
    env: { PORT: port, APP_URL: `http://localhost:${port}` },
    timeout: 120_000,
  },
});
