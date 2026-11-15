import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { LOCALES, ROLES, THEMES } from "@/config/app";
import { AppError } from "@/server/errors";
import { auth } from "./auth";
import type { Actor, Locale, Role, Theme } from "./types";

function pick<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return values.find((candidate) => candidate === value) ?? fallback;
}

/**
 * The signed-in actor of the current request, or null. Returns null for banned/archived users.
 * Better Auth reads the user row on every call (cookie cache is disabled), so role, locale and
 * theme are current.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user as typeof session.user & {
    role?: string | null;
    banned?: boolean | null;
    firstName: string;
    lastName: string;
    locale?: string | null;
    theme?: string | null;
    onboardingStatus?: string | null;
  };
  if (user.banned || user.onboardingStatus === "archived") return null;
  return {
    id: user.id,
    role: pick<Role>(ROLES, user.role, "employee"),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    locale: pick<Locale>(LOCALES, user.locale, "de"),
    theme: pick<Theme>(THEMES, user.theme, "system"),
  };
});

/** @throws AppError("UNAUTHENTICATED") */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AppError("UNAUTHENTICATED");
  return actor;
}
