import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { pageEditLocks } from "@/server/db/schema";

export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

/** Makes an existing edit lock expire (one second in the past, using the database clock). */
export async function expireLock(pageId: string): Promise<void> {
  await db
    .update(pageEditLocks)
    .set({ expiresAt: sql`now() - interval '1 second'` })
    .where(eq(pageEditLocks.pageId, pageId));
}
