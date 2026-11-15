/**
 * Recreates the disposable E2E database, migrates it and fills it with the demo data.
 * Run by the Playwright web server command before the app starts (see playwright.config.ts).
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import {
  E2E_ADMIN_DATABASE_URL,
  E2E_AUTH_SECRET,
  E2E_DATABASE_URL,
  E2E_DB_NAME,
  E2E_PASSWORD,
} from "./constants";

async function recreateDatabase(): Promise<void> {
  const pool = new Pool({ connectionString: E2E_ADMIN_DATABASE_URL });
  try {
    await pool.query(`DROP DATABASE IF EXISTS ${E2E_DB_NAME} WITH (FORCE)`);
    await pool.query(`CREATE DATABASE ${E2E_DB_NAME}`);
  } finally {
    await pool.end();
  }
}

async function migrateDatabase(): Promise<void> {
  const pool = new Pool({ connectionString: E2E_DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  } finally {
    await pool.end();
  }
}

await recreateDatabase();
await migrateDatabase();

process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.BETTER_AUTH_SECRET = E2E_AUTH_SECRET;
process.env.MAIL_TRANSPORT = "memory";
process.env.LOG_LEVEL = "warn";

const { runDemoSeed } = await import("../../../scripts/demo-data/run");
const { closeDb } = await import("@/server/db/client");
try {
  await runDemoSeed({ reset: false, password: E2E_PASSWORD, nodeEnv: "test" });
  console.log(`E2E database ${E2E_DB_NAME} ready`);
} finally {
  await closeDb();
}
