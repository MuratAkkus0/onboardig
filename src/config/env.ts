import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: booleanString.default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  MAIL_FROM: z.string().min(1).default("Onboarding Portal <noreply@example.com>"),
  MAIL_TRANSPORT: z.enum(["smtp", "memory"]).default("smtp"),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parses process.env on first access (not at import time) so tests and scripts can set variables first.
 * Error messages only name the failing variables, never their values.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const input = { ...process.env };
  if (input.NODE_ENV === "test") {
    // Test runs and the production build never need a real secret.
    input.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
  }
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
  }
  cached = result.data;
  return cached;
}

/** Test-only: forget the parsed environment so the next access re-reads process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}

export const env: Env = new Proxy({} as Env, {
  get: (_target, property: string) => getEnv()[property as keyof Env],
  has: (_target, property: string) => property in getEnv(),
  ownKeys: () => Reflect.ownKeys(getEnv()),
  getOwnPropertyDescriptor: (_target, property: string) => ({
    enumerable: true,
    configurable: true,
    value: getEnv()[property as keyof Env],
  }),
});
