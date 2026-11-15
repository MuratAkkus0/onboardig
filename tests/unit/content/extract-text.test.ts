import { describe, expect, it } from "vitest";
import { extractText } from "@/lib/tiptap/extract-text";
import { doc } from "../../helpers/tiptap";

describe("extractText", () => {
  it("joins paragraphs with line breaks", () => {
    expect(extractText(doc("Erster Absatz", "Zweiter Absatz"))).toBe(
      "Erster Absatz\nZweiter Absatz",
    );
  });

  it("flattens marks, lists, headings and hard breaks", () => {
    const input = {
      type: "doc" as const,
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Urlaub" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bitte ", marks: [{ type: "bold" }] },
            { type: "text", text: "beantragen" },
            { type: "hardBreak" },
            { type: "text", text: "rechtzeitig" },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "eins" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "zwei" }] }],
            },
          ],
        },
      ],
    };
    expect(extractText(input)).toBe("Urlaub\nBitte beantragen rechtzeitig\neins\nzwei");
  });

  it("collapses whitespace and drops empty blocks", () => {
    expect(extractText(doc("a   b", "", "  c  "))).toBe("a b\nc");
  });

  it("returns an empty string for empty or missing documents", () => {
    expect(extractText({ type: "doc", content: [] })).toBe("");
    expect(extractText(null)).toBe("");
    expect(extractText(undefined)).toBe("");
  });
});
