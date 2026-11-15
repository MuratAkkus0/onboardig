import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/** Internal (no actor): used by GET /api/health and the Docker healthcheck. */
export async function checkDatabase(): Promise<{ ok: boolean }> {
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
