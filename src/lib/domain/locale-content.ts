import type { TiptapDoc } from "@/server/db/schema/custom-types";

interface DocNode {
  type?: string;
  text?: string;
  content?: unknown[];
}

function nodeHasContent(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  const { type, text, content } = node as DocNode;
  if (type === "image") return true;
  if (typeof text === "string" && text.trim() !== "") return true;
  return Array.isArray(content) && content.some(nodeHasContent);
}

/** True when the document has no non-whitespace text node and no image. */
export function isEmptyDoc(doc: TiptapDoc | null | undefined): boolean {
  if (!doc) return true;
  return !nodeHasContent(doc);
}

/** The single definition of "this page has an English variant" (blueprint section 2.3). */
export function hasEnglish(page: {
  titleEn: string | null | undefined;
  contentEn: TiptapDoc | null | undefined;
}): boolean {
  return (
    typeof page.titleEn === "string" &&
    page.titleEn.trim() !== "" &&
    page.contentEn != null &&
    !isEmptyDoc(page.contentEn)
  );
}

/** Same rule for events: both English fields filled. */
export function hasEnglishEvent(event: {
  titleEn: string | null | undefined;
  descriptionEn: string | null | undefined;
}): boolean {
  return (
    typeof event.titleEn === "string" &&
    event.titleEn.trim() !== "" &&
    typeof event.descriptionEn === "string" &&
    event.descriptionEn.trim() !== ""
  );
}
