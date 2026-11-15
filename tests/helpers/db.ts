import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/** Raw database handle for assertions (the app's lazy client, pointed at the test database). */
export const testDb = db;

const TABLE_NAMES = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => `"${getTableName(table as PgTable)}"`);

/** Empties every application table (list generated from the schema). */
export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLE_NAMES.join(", ")} RESTART IDENTITY CASCADE`));
}
