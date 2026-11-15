import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { contentExtensions } from "@/lib/tiptap/extensions";
import { toPlainJson } from "@/lib/tiptap/plain-json";

function attrsOfHeading(doc: unknown): object {
  const heading = (doc as { content: { attrs: object }[] }).content[0]!;
  return heading.attrs;
}

describe("toPlainJson", () => {
  it("turns null-prototype node attrs into plain objects that keep their values", () => {
    const editor = new Editor({
      extensions: contentExtensions,
      content: { type: "doc", content: [{ type: "heading", attrs: { level: 3 } }] },
    });
    const raw = editor.getJSON();
    expect(Object.getPrototypeOf(attrsOfHeading(raw))).toBeNull();

    const plain = toPlainJson(raw);
    expect(Object.getPrototypeOf(attrsOfHeading(plain))).toBe(Object.prototype);
    expect(attrsOfHeading(plain)).toEqual({ level: 3 });
    editor.destroy();
  });
});
