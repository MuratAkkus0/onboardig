import "server-only";
import pino from "pino";
import { env } from "@/config/env";

// Never log credentials, tokens, cookies, invitation links or mail bodies. Log only errors and
// mutations (action name, entity id, actor id); never view/read events (no page-view history).
const REDACT_PATHS = [
  "password",
  "newPassword",
  "token",
  "*.password",
  "*.newPassword",
  "*.token",
  "*.tokenHash",
  "headers.cookie",
  "headers.authorization",
  "req.headers.cookie",
  "req.headers.authorization",
  "cookie",
  "authorization",
  "link",
  "html",
  "text",
];

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  ...(env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
