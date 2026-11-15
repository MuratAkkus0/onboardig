import { describe, expect, it } from "vitest";
import { parseHeadline, splitFragment } from "@/components/search/highlight";
import { searchInputSchema } from "@/lib/validation/search";

describe("parseHeadline", () => {
  it("extracts plain text and highlight ranges", () => {
    expect(parseHeadline("Ein \u0002Urlaub\u0003 beantragen")).toEqual([
      { text: "Ein Urlaub beantragen", highlights: [[4, 10]] },
    ]);
  });

  it("splits fragments on the delimiter and drops empty ones", () => {
    const result = parseHeadline("a \u0002b\u0003\u0001c \u0002d\u0003\u0001  ");
    expect(result.map((fragment) => fragment.text)).toEqual(["a b", "c d"]);
  });

  it("keeps HTML literal instead of interpreting it", () => {
    const [fragment] = parseHeadline("<script>alert(1)</script> \u0002x\u0003");
    expect(fragment?.text).toBe("<script>alert(1)</script> x");
    expect(fragment?.highlights).toEqual([[26, 27]]);
  });

  it("closes an unterminated highlight", () => {
    expect(parseHeadline("ab \u0002cd")).toEqual([{ text: "ab cd", highlights: [[3, 5]] }]);
  });
});

describe("splitFragment", () => {
  it("alternates plain and highlighted parts", () => {
    expect(splitFragment({ text: "ab cd ef", highlights: [[3, 5]] })).toEqual([
      { text: "ab ", highlighted: false },
      { text: "cd", highlighted: true },
      { text: " ef", highlighted: false },
    ]);
  });
});

describe("searchInputSchema", () => {
  it("trims, collapses whitespace and strips control characters", () => {
    expect(searchInputSchema.parse({ q: "  a\u0002b \n c " }).q).toBe("a b c");
  });

  it("rejects over-long queries", () => {
    expect(searchInputSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});
