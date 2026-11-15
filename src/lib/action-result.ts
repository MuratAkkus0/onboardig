import type { ErrorCode } from "@/server/errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ErrorCode;
        messageKey: string;
        fieldErrors?: Record<string, string[]>;
        details?: Record<string, unknown>;
      };
    };
