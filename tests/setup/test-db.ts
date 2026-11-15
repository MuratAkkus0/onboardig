import { createHash } from "node:crypto";
import path from "node:path";

const DEFAULT_DEV_DATABASE_URL = "postgres://onboarding:onboarding@localhost:5433/onboarding";

/**
 * Database used by integration tests. Unique per checkout path, so parallel worktrees never
 * touch each other's data. `TEST_DATABASE_URL` overrides it (CI).
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = new URL(process.env.DATABASE_URL ?? DEFAULT_DEV_DATABASE_URL);
  const dir = path
    .basename(process.cwd())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30);
  const hash = createHash("sha1").update(process.cwd()).digest("hex").slice(0, 8);
  base.pathname = `/onboarding_test_${dir}_${hash}`;
  return base.toString();
}

export function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}
