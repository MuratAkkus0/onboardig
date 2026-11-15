import type { JSONContent } from "@tiptap/core";

/** Serializable page data handed from the edit route to the editor. */
export interface EditablePage {
  id: string;
  moduleTitle: string;
  status: "draft" | "published" | "archived";
  titleDe: string;
  titleEn: string | null;
  contentDe: JSONContent;
  contentEn: JSONContent | null;
  lastEditedAt: string;
  lastEditedByName: string | null;
}

/** An empty document as the editor itself produces it. */
export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
