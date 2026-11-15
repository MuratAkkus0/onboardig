import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../../src");
const ALLOWED = new Set([path.join(SRC, "styles/tokens.css")]);
const HEX = /#[0-9a-fA-F]{3,8}\b(?![-\w])/;
const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/;
const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)(?:-\d{2,3})?\b/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("colors live only in tokens.css", () => {
  it("has no raw colors or palette classes in src", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (ALLOWED.has(file)) continue;
      // Mail templates are deliberately color-free; they must not contain colors either.
      const text = readFileSync(file, "utf8");
      if (HEX.test(text) || COLOR_FN.test(text) || PALETTE.test(text)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
