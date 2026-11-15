import { existsSync } from "node:fs";
import path from "node:path";

/** Loads `.env` into process.env when the file exists (CI and production set variables directly). */
export function loadEnv(): void {
  const file = path.resolve(process.cwd(), ".env");
  if (existsSync(file)) process.loadEnvFile(file);
}
