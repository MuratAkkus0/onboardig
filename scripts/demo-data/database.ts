import { count, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

const TABLE_NAMES = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => `"${getTableName(table as PgTable)}"`);

/** Trusted-script helper (no actor): number of existing users, any role or status. */
export async function countUsers(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(schema.users);
  return row?.value ?? 0;
}

/** Trusted-script helper: empties every application table (list generated from the schema). */
export async function wipeAllTables(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLE_NAMES.join(", ")} RESTART IDENTITY CASCADE`));
}
