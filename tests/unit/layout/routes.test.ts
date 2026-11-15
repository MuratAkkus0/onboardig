import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/app";

const APP_DIR = path.resolve(import.meta.dirname, "../../../src/app");
const SENTINEL = "__param__";

/** Finds the page.tsx a URL path resolves to, ignoring route groups; null when none exists. */
function resolvePage(segments: string[], dir: string): string | null {
  const [head, ...rest] = segments;
  if (head === undefined) {
    const direct = path.join(dir, "page.tsx");
    if (existsSync(direct)) return direct;
    for (const group of subdirs(dir).filter((name) => /^\(.+\)$/.test(name))) {
      const found = resolvePage([], path.join(dir, group));
      if (found) return found;
    }
    return null;
  }
  const candidates = subdirs(dir).filter(
    (name) => name === head || (name.startsWith("[") && head === SENTINEL),
  );
  for (const name of candidates) {
    const found = resolvePage(rest, path.join(dir, name));
    if (found) return found;
  }
  for (const group of subdirs(dir).filter((name) => /^\(.+\)$/.test(name))) {
    const found = resolvePage(segments, path.join(dir, group));
    if (found) return found;
  }
  return null;
}

function subdirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

describe("route map", () => {
  it("has a page for every route in ROUTES", () => {
    for (const [name, value] of Object.entries(ROUTES)) {
      const url = typeof value === "function" ? value(SENTINEL) : value;
      const segments = url.split("/").filter(Boolean);
      expect(resolvePage(segments, APP_DIR), `${name} ${url}`).not.toBeNull();
    }
  });

  it("guards the restricted route groups with a layout", () => {
    for (const group of ["team", "library", "admin"]) {
      expect(existsSync(path.join(APP_DIR, "(app)", group, "layout.tsx")), group).toBe(true);
    }
  });
});
