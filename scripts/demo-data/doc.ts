import type { TiptapDoc } from "@/server/db/schema";

type Inline = string;

function paragraph(text: Inline) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function listItem(text: Inline) {
  return { type: "listItem", content: [paragraph(text)] };
}

/** Block builders for the demo pages (headings 2 and 3 only, like the editor). */
export const h2 = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
export const h3 = (text: string) => ({
  type: "heading",
  attrs: { level: 3 },
  content: [{ type: "text", text }],
});
export const p = paragraph;
export const ul = (...items: string[]) => ({ type: "bulletList", content: items.map(listItem) });
export const ol = (...items: string[]) => ({ type: "orderedList", content: items.map(listItem) });

export function doc(...blocks: object[]): TiptapDoc {
  return { type: "doc", content: blocks };
}

/** Returns a copy of `source` with one paragraph appended. */
export function withParagraph(source: TiptapDoc, text: string): TiptapDoc {
  return doc(...((source.content ?? []) as object[]), p(text));
}
