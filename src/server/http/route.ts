import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { F2A_CONFIG } from "@/config/app";
import { env } from "@/config/env";
import { getActor } from "@/server/auth/actor";
import type { Actor } from "@/server/auth/types";
import { AppError, isAppError, pgErrorCode, rethrowDbError } from "@/server/errors";
import { logger } from "@/server/logger";

type Params = Record<string, string>;

function errorResponse(error: AppError, fieldErrors?: Record<string, string[]>): Response {
  return NextResponse.json(
    {
      code: error.code,
      messageKey: error.messageKey,
      details: fieldErrors ? { ...error.details, fieldErrors } : (error.details ?? null),
    },
    { status: F2A_CONFIG.http.statusByErrorCode[error.code] },
  );
}

function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

function toErrorResponse(e: unknown): Response {
  if (isNextControlFlow(e)) throw e;
  if (isAppError(e)) return errorResponse(e);
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of e.issues) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
    return errorResponse(new AppError("VALIDATION", { fieldErrors }));
  }
  if (pgErrorCode(e)) {
    try {
      rethrowDbError(e);
    } catch (mapped) {
      if (isAppError(mapped)) return errorResponse(mapped);
    }
  }
  logger.error({ err: e instanceof Error ? e.message : "unknown" }, "route failed");
  return errorResponse(new AppError("INTERNAL"));
}

function hasAllowedOrigin(req: NextRequest): boolean {
  return req.headers.get("origin") === new URL(env.APP_URL).origin;
}

/**
 * Wraps a route handler: 401 without a session, maps errors to HTTP (same mapping as
 * `runAction`), and for unsafe methods rejects requests whose Origin is not `APP_URL` (CSRF guard
 * for fetch/beacon endpoints). Route params are a Promise in Next 16; they are resolved here.
 */
export function withActor<P extends Params = Record<string, never>>(
  handler: (req: NextRequest, ctx: { actor: Actor; params: P }) => Promise<Response>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const isSafe = (F2A_CONFIG.http.safeMethods as readonly string[]).includes(req.method);
      if (!isSafe && !hasAllowedOrigin(req)) throw new AppError("FORBIDDEN");
      const actor = await getActor();
      if (!actor) throw new AppError("UNAUTHENTICATED");
      return await handler(req, { actor, params: await ctx.params });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
