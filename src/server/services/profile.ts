import "server-only";
import { eq } from "drizzle-orm";
import type { Actor, Locale, Theme } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { updatePreferencesSchema, type UpdatePreferencesInput } from "@/lib/validation/profile";

export interface Preferences {
  locale: Locale;
  theme: Theme;
}

/** Own preferences only: every signed-in role may change their own language and theme. */
export async function updateMyPreferences(
  actor: Actor,
  input: UpdatePreferencesInput,
): Promise<Preferences> {
  // No role restriction: the update is scoped to actor.id, so it can only ever touch the own row.
  const { locale, theme } = updatePreferencesSchema.parse(input);
  const [row] = await db
    .update(users)
    .set({ ...(locale ? { locale } : {}), ...(theme ? { theme } : {}), updatedAt: new Date() })
    .where(eq(users.id, actor.id))
    .returning({ locale: users.locale, theme: users.theme });
  if (!row) throw new AppError("NOT_FOUND");
  logger.info({ action: "profile.preferences", entityId: actor.id, actorId: actor.id }, "mutation");
  return row;
}
