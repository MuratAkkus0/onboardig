import type { TiptapDoc } from "@/server/db/schema/custom-types";

interface DocNode {
  type?: string;
  text?: string;
  content?: unknown[];
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "codeBlock",
  "bulletList",
  "orderedList",
  "horizontalRule",
]);

function walk(node: unknown, out: string[]): void {
  if (typeof node !== "object" || node === null) return;
  const { type, text, content } = node as DocNode;
  if (type === "text") {
    if (typeof text === "string") out.push(text);
    return;
  }
  if (type === "hardBreak") {
    out.push(" ");
    return;
  }
  if (Array.isArray(content)) for (const child of content) walk(child, out);
  if (type && BLOCK_TYPES.has(type)) out.push("\n");
}

/**
 * Plain text of a document for `pages.text_de/text_en` (the generated tsvector reads these).
 * Blocks are separated by a line break, hard breaks and runs of spaces collapse to one space.
 */
export function extractText(doc: TiptapDoc | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  walk(doc, parts);
  return parts
    .join("")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}
