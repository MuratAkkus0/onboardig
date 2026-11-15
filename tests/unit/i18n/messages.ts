import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const MESSAGES_DIR = path.resolve(import.meta.dirname, "../../../messages");

export function readNamespaces(locale: string): Record<string, Record<string, unknown>> {
  const dir = path.join(MESSAGES_DIR, locale);
  return Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => [
        file.replace(/\.json$/, ""),
        JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Record<string, unknown>,
      ]),
  );
}

export function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  const entries = Object.entries(value);
  if (entries.length === 0) return [];
  return entries.flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}
