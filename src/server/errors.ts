export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "IN_USE",
  "INVALID_TRANSITION",
  "LOCK_HELD",
  "LOCK_LOST",
  "INVITE_INVALID",
  "INVITE_EXPIRED",
  "LAST_ADMIN",
  "FILE_TOO_LARGE",
  "FILE_TYPE_NOT_ALLOWED",
  "EMAIL_TAKEN",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, details?: Record<string, unknown>, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get messageKey(): `errors.${ErrorCode}` {
    return `errors.${this.code}`;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** PostgreSQL SQLSTATE codes services can race into (blueprint section 1, "DB errors"). */
export const PG_ERROR = {
  foreignKeyViolation: "23503",
  /** ON DELETE RESTRICT reports 23001 instead of 23503. */
  restrictViolation: "23001",
  uniqueViolation: "23505",
  deadlockDetected: "40P01",
} as const;

/** Reads the SQLSTATE of a pg error, also when drizzle wrapped it as `cause`. */
export function pgErrorCode(e: unknown): string | undefined {
  let current: unknown = e;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Maps a Postgres error to an AppError and throws it. Anything that is not one of the known
 * race errors is rethrown unchanged.
 * - 23503 (FK) and 23001 (RESTRICT): `map.fk`, default CONFLICT (use IN_USE on delete paths)
 * - 23505 (unique): `map.unique`, default CONFLICT
 * - 40P01 (deadlock): CONFLICT
 */
export function rethrowDbError(
  e: unknown,
  map: { fk?: ErrorCode; unique?: ErrorCode } = {},
): never {
  if (isAppError(e)) throw e;
  switch (pgErrorCode(e)) {
    case PG_ERROR.foreignKeyViolation:
    case PG_ERROR.restrictViolation:
      throw new AppError(map.fk ?? "CONFLICT", undefined, "foreign key violation");
    case PG_ERROR.uniqueViolation:
      throw new AppError(map.unique ?? "CONFLICT", undefined, "unique violation");
    case PG_ERROR.deadlockDetected:
      throw new AppError("CONFLICT", undefined, "deadlock detected");
    default:
      throw e;
  }
}

/**
 * Log-safe description of an unexpected error. Drizzle's query errors carry the whole SQL text and
 * every bound parameter (hashes, emails, page content) in their message, so only the error name
 * and SQLSTATE are logged for them; other errors keep their message.
 */
export function describeError(e: unknown): { name: string; code?: string; message?: string } {
  if (!(e instanceof Error)) return { name: "unknown" };
  const code = pgErrorCode(e);
  const fromDatabase = code !== undefined || e.message.startsWith("Failed query:");
  return {
    name: e.name,
    ...(code ? { code } : {}),
    ...(fromDatabase ? {} : { message: e.message }),
  };
}
