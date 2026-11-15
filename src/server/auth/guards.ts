import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionCookie } from "better-auth/cookies";
import { ROUTES } from "@/config/app";
import { getActor } from "./actor";
import type { Actor, Role } from "./types";

const SESSION_ENDED_QUERY = "?reason=session-ended";

/**
 * For pages/layouts. Redirects to login when there is no valid session; when a session cookie is
 * still present (session deleted server-side) the login page is told so it can clear the cookie.
 */
export async function requirePageActor(): Promise<Actor> {
  const actor = await getActor();
  if (actor) return actor;
  const cookieHeader = (await cookies()).toString();
  const hasStaleCookie = Boolean(getSessionCookie(new Headers({ cookie: cookieHeader })));
  redirect(hasStaleCookie ? `${ROUTES.login}${SESSION_ENDED_QUERY}` : ROUTES.login);
}

/** Like requirePageActor, but answers 404 for other roles (do not reveal admin pages). */
export async function requirePageRole(roles: readonly Role[]): Promise<Actor> {
  const actor = await requirePageActor();
  if (!roles.includes(actor.role)) notFound();
  return actor;
}
