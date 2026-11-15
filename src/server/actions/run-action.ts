import "server-only";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getActor } from "@/server/auth/actor";
import type { Actor } from "@/server/auth/types";
import { AppError, describeError, isAppError, pgErrorCode, rethrowDbError } from "@/server/errors";
import { logger } from "@/server/logger";

function toFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function failure(error: AppError, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  const details = error.details;
  return {
    ok: false,
    error: {
      code: error.code,
      messageKey: error.messageKey,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(details ? { details } : {}),
    },
  };
}

function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

function toActionError(e: unknown): ActionResult<never> {
  // redirect()/notFound() are control flow, not failures: let Next handle them.
  if (isNextControlFlow(e)) throw e;
  if (isAppError(e)) {
    const raw = e.details?.fieldErrors;
    const fieldErrors =
      e.code === "VALIDATION" && raw && typeof raw === "object"
        ? (raw as Record<string, string[]>)
        : undefined;
    return failure(e, fieldErrors);
  }
  if (e instanceof ZodError) {
    const fieldErrors = toFieldErrors(e);
    return failure(new AppError("VALIDATION", { fieldErrors }), fieldErrors);
  }
  if (pgErrorCode(e)) {
    try {
      rethrowDbError(e);
    } catch (mapped) {
      if (isAppError(mapped)) return failure(mapped);
    }
  }
  logger.error({ err: describeError(e) }, "action failed");
  return failure(new AppError("INTERNAL"));
}

/** Runs a server action body for the signed-in actor and converts every failure to an ActionResult. */
export async function runAction<T>(fn: (actor: Actor) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const actor = await getActor();
    if (!actor) throw new AppError("UNAUTHENTICATED");
    return { ok: true, data: await fn(actor) };
  } catch (e) {
    return toActionError(e);
  }
}

/** Same as runAction for public actions (login helpers, invitation acceptance). */
export async function runPublicAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return toActionError(e);
  }
}
