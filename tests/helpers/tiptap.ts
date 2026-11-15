import type { TiptapDoc } from "@/server/db/schema";

/** `doc("a", "b")` builds a Tiptap document with one paragraph per argument. */
export function doc(...paragraphs: string[]): TiptapDoc {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text === "" ? [] : [{ type: "text", text }],
    })),
  };
}
