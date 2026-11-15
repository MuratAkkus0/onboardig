"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { APP_CONFIG, F2B_CONFIG } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import { localeSchema } from "@/lib/validation/common";
import { themeSchema } from "@/lib/validation/profile";
import { getActor } from "@/server/auth/actor";
import { runAction, runPublicAction } from "./run-action";
import { updateMyPreferences } from "@/server/services/profile";

/** Works signed out (cookie only) and signed in (profile + cookie). */
export async function setLocaleAction(locale: string): Promise<ActionResult> {
  return runPublicAction(async () => {
    const parsed = localeSchema.parse(locale);
    const actor = await getActor();
    if (actor) await updateMyPreferences(actor, { locale: parsed });
    (await cookies()).set(APP_CONFIG.i18n.localeCookie, parsed, {
      path: "/",
      maxAge: F2B_CONFIG.localeCookieMaxAgeSeconds,
      sameSite: "lax",
    });
    revalidatePath("/", "layout");
  });
}

/** Signed in only: the theme is stored on the profile. */
export async function setThemeAction(theme: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await updateMyPreferences(actor, { theme: themeSchema.parse(theme) });
    revalidatePath("/", "layout");
  });
}
