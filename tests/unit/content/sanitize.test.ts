import { describe, expect, it } from "vitest";
import { InvalidDocumentError, sanitizeDoc } from "@/lib/tiptap/sanitize";
import { doc } from "../../helpers/tiptap";

const UPLOAD_ID = "3f2b8f0e-9d1c-4c55-8a5e-0d6f4d2b9c11";

function textWithMarks(text: string, marks: unknown[]) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text, marks }] }],
  };
}

describe("sanitizeDoc", () => {
  it("keeps allowed nodes and marks", () => {
    const input = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titel" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "fett", marks: [{ type: "bold" }, { type: "italic" }] }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
            },
          ],
        },
      ],
    };
    expect(sanitizeDoc(input)).toEqual(input);
  });

  it("removes unknown nodes and unknown marks", () => {
    const input = {
      type: "doc",
      content: [
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "ok", marks: [{ type: "textStyle", attrs: { color: "red" } }] },
          ],
        },
      ],
    };
    expect(sanitizeDoc(input)).toEqual(doc("ok"));
  });

  it("drops attributes that are not on the allow list", () => {
    const input = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { onclick: "x()", style: "color:red" },
          content: [{ type: "text", text: "a" }],
        },
      ],
    };
    expect(sanitizeDoc(input)).toEqual(doc("a"));
  });

  it.each(["http://example.com/a", "https://example.com", "mailto:someone@example.com"])(
    "keeps the link %s",
    (href) => {
      const result = sanitizeDoc(textWithMarks("link", [{ type: "link", attrs: { href } }]));
      expect(JSON.stringify(result)).toContain(href);
    },
  );

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html;base64,AAAA",
    "vbscript:x",
    "//evil.example",
    "/relative",
    "",
  ])("removes the link mark but keeps the text for %j", (href) => {
    const result = sanitizeDoc(textWithMarks("klick", [{ type: "link", attrs: { href } }]));
    expect(result).toEqual(doc("klick"));
  });

  it("keeps images that point at an upload url and normalizes the id", () => {
    const input = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: `/api/uploads/${UPLOAD_ID.toUpperCase()}`, alt: "Foto", onerror: "x()" },
        },
      ],
    };
    expect(sanitizeDoc(input)).toEqual({
      type: "doc",
      content: [{ type: "image", attrs: { src: `/api/uploads/${UPLOAD_ID}`, alt: "Foto" } }],
    });
  });

  it.each([
    "https://evil.example/x.png",
    "data:image/png;base64,AAAA",
    "/api/uploads/not-a-uuid",
    `/api/uploads/${UPLOAD_ID}?x=1`,
    `/api/uploads/${UPLOAD_ID}/../other`,
    `//evil.example/api/uploads/${UPLOAD_ID}`,
  ])("removes the image with src %s", (src) => {
    const input = {
      type: "doc",
      content: [{ type: "image", attrs: { src } }, ...doc("Text").content!],
    };
    expect(sanitizeDoc(input)).toEqual(doc("Text"));
  });

  it("clamps heading levels to the allowed range", () => {
    const heading = (level: number) => ({
      type: "doc",
      content: [{ type: "heading", attrs: { level }, content: [{ type: "text", text: "h" }] }],
    });
    expect(sanitizeDoc(heading(1)).content).toEqual([
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "h" }] },
    ]);
    expect(sanitizeDoc(heading(6)).content).toEqual([
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "h" }] },
    ]);
  });

  it("stores an empty document as an empty doc", () => {
    expect(sanitizeDoc({ type: "doc", content: [{ type: "paragraph" }] })).toEqual({
      type: "doc",
      content: [],
    });
    expect(sanitizeDoc({ type: "doc" })).toEqual({ type: "doc", content: [] });
  });

  it("rejects input that is not a document", () => {
    for (const input of [null, "text", [], { type: "paragraph" }]) {
      expect(() => sanitizeDoc(input)).toThrow(InvalidDocumentError);
    }
  });

  it("rejects structures the editor schema would not accept", () => {
    const input = { type: "doc", content: [{ type: "text", text: "loose text" }] };
    expect(() => sanitizeDoc(input)).toThrowError(
      expect.objectContaining({ reason: "invalidStructure" }),
    );
  });

  it("rejects oversized documents", () => {
    const huge = doc("x".repeat(3 * 1024 * 1024));
    expect(() => sanitizeDoc(huge)).toThrowError(expect.objectContaining({ reason: "tooLarge" }));
  });
});
