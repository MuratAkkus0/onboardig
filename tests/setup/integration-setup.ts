import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { testDatabaseUrl } from "./test-db";

// Must run before any app module is imported, so the lazy db client sees the test database.
process.env.DATABASE_URL = testDatabaseUrl();

let uploadDir: string | undefined;

beforeAll(async () => {
  uploadDir = await mkdtemp(path.join(tmpdir(), "onboarding-uploads-"));
  process.env.UPLOAD_DIR = uploadDir;
});

beforeEach(async () => {
  const { resetDb } = await import("../helpers/db");
  await resetDb();
});

afterAll(async () => {
  const { closeDb } = await import("@/server/db/client");
  await closeDb();
  if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
});
