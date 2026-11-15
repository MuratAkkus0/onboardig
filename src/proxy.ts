import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { F2B_CONFIG, ROUTES } from "@/config/app";

const PUBLIC_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.setPassword,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
];

/**
 * Optimistic gate, one direction only: no session cookie on an (app) path => /login?next=...
 * It never redirects away from the auth pages (a stale cookie would loop /login <-> /). Real
 * checks happen in the layouts (requirePageActor) and in the services.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || getSessionCookie(request)) return NextResponse.next();
  const login = new URL(ROUTES.login, request.url);
  login.searchParams.set(F2B_CONFIG.queryParams.next, `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Excludes API routes, Next internals and files with an extension (static assets).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
