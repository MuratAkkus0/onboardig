import { existsSync } from "node:fs";
import path from "node:path";

// Load `.env` only when present (CI sets variables directly), then force test mode no matter
// what `.env` says.
if (existsSync(".env")) process.loadEnvFile(".env");
Object.assign(process.env, { NODE_ENV: "test", MAIL_TRANSPORT: "memory" });

export const sharedConfig = {
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/setup/empty-module.ts"),
    },
  },
  test: {
    environment: "node" as const,
  },
};
