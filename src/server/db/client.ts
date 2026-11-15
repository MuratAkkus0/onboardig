import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbExecutor = Db | Tx;

interface DbState {
  pool: Pool;
  db: Db;
}

// Cached on globalThis so Next.js HMR in dev does not open a new pool per reload.
const globalForDb = globalThis as unknown as { __onboardingDb?: DbState };

function getState(): DbState {
  if (!globalForDb.__onboardingDb) {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    globalForDb.__onboardingDb = { pool, db: drizzle(pool, { schema }) };
  }
  return globalForDb.__onboardingDb;
}

/** Lazy: the connection string is read on first use, so tests can set the env first. */
export const db: Db = new Proxy({} as Db, {
  get: (_target, property) => {
    const instance = getState().db;
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export async function closeDb(): Promise<void> {
  const state = globalForDb.__onboardingDb;
  if (!state) return;
  globalForDb.__onboardingDb = undefined;
  await state.pool.end();
}
