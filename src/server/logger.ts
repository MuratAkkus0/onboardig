import "server-only";
import pino, { type DestinationStream } from "pino";
import { env } from "@/config/env";

// Never log credentials, tokens, cookies, invitation links or mail bodies. Log only errors and
// mutations (action name, entity id, actor id); never view/read events (no page-view history).
export const REDACT_PATHS = [
  "password",
  "newPassword",
  "token",
  "url",
  "link",
  "html",
  "text",
  "cookie",
  "authorization",
  "*.password",
  "*.newPassword",
  "*.token",
  "*.tokenHash",
  "*.url",
  "*.link",
  "*.html",
  "*.text",
  "*.cookie",
  "*.authorization",
  "headers.cookie",
  "headers.authorization",
  "req.headers.cookie",
  "req.headers.authorization",
];

/** Exported for tests, which pass their own destination stream. */
export function createLogger(options: { level?: string; destination?: DestinationStream } = {}) {
  return pino(
    {
      level: options.level ?? (env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL),
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      ...(!options.destination && env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : {}),
    },
    options.destination,
  );
}

export const logger = createLogger();
