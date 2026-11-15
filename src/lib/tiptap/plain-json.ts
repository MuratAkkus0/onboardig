import type { JSONContent } from "@tiptap/core";

/**
 * ProseMirror builds node attrs with `Object.create(null)`, which React serializes as an opaque
 * temporary reference when a document is sent to a server action (the server would receive no
 * attrs at all). Returns a deep copy made of plain objects only.
 */
export function toPlainJson(content: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(content)) as JSONContent;
}
