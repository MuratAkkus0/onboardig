import { getSchema } from "@tiptap/core";
import { W1_CONTENT_CONFIG } from "@/config/app";
import { contentExtensions } from "@/lib/tiptap/extensions";
import { isAllowedHref } from "@/lib/tiptap/links";
import { parseUploadSrc, uploadUrl } from "@/lib/tiptap/uploads";
import { isEmptyDoc } from "@/lib/domain/locale-content";
import type { TiptapDoc } from "@/server/db/schema/custom-types";

type Json = Record<string, unknown>;
type Mark = { type: string; attrs?: Json };
type Node = { type: string; attrs?: Json; content?: Node[]; text?: string; marks?: Mark[] };

const MAX_DEPTH = 12;
const MAX_ALT_LENGTH = 300;
const CODE_LANGUAGE = /^[A-Za-z0-9+#._-]{1,30}$/;

export type InvalidDocumentReason = "tooLarge" | "notADocument" | "invalidStructure";

/** Thrown when a document cannot be turned into a valid, storable document. */
export class InvalidDocumentError extends Error {
  constructor(readonly reason: InvalidDocumentReason) {
    super(`invalid document: ${reason}`);
    this.name = "InvalidDocumentError";
  }
}

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const MARKS: Record<string, (attrs: Json) => Json | null | false> = {
  bold: () => null,
  italic: () => null,
  underline: () => null,
  strike: () => null,
  code: () => null,
  // false drops the mark (the text stays), e.g. javascript: links
  link: (attrs) =>
    typeof attrs.href === "string" && isAllowedHref(attrs.href)
      ? { href: attrs.href.trim() }
      : false,
};

const NODES: Record<string, (attrs: Json) => Json | null | false> = {
  paragraph: () => null,
  blockquote: () => null,
  bulletList: () => null,
  listItem: () => null,
  hardBreak: () => null,
  horizontalRule: () => null,
  heading: (attrs) => {
    const levels = W1_CONTENT_CONFIG.headingLevels;
    const requested = typeof attrs.level === "number" ? attrs.level : (levels[0] ?? 2);
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    return { level: Math.min(max, Math.max(min, Math.trunc(requested))) };
  },
  orderedList: (attrs) => ({
    start: typeof attrs.start === "number" && attrs.start >= 1 ? Math.trunc(attrs.start) : 1,
  }),
  codeBlock: (attrs) => ({
    language:
      typeof attrs.language === "string" && CODE_LANGUAGE.test(attrs.language)
        ? attrs.language
        : null,
  }),
  // false drops the node: images may only point at our own upload URLs
  image: (attrs) => {
    const id = parseUploadSrc(attrs.src);
    if (!id) return false;
    const alt = typeof attrs.alt === "string" ? attrs.alt.slice(0, MAX_ALT_LENGTH) : null;
    return { src: uploadUrl(id), alt };
  },
};

function sanitizeMarks(marks: unknown): Mark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const result: Mark[] = [];
  for (const mark of marks) {
    if (!isObject(mark) || typeof mark.type !== "string") continue;
    const rule = MARKS[mark.type];
    if (!rule || result.some((existing) => existing.type === mark.type)) continue;
    const attrs = rule(isObject(mark.attrs) ? mark.attrs : {});
    if (attrs === false) continue;
    result.push(attrs ? { type: mark.type, attrs } : { type: mark.type });
  }
  return result.length > 0 ? result : undefined;
}

function sanitizeNode(node: unknown, depth: number): Node | null {
  if (!isObject(node) || typeof node.type !== "string" || depth > MAX_DEPTH) return null;
  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text === "") return null;
    const marks = sanitizeMarks(node.marks);
    return marks ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
  }
  const rule = NODES[node.type];
  if (!rule) return null;
  const attrs = rule(isObject(node.attrs) ? node.attrs : {});
  if (attrs === false) return null;
  const result: Node = { type: node.type };
  if (attrs) result.attrs = attrs;
  if (Array.isArray(node.content)) {
    result.content = node.content.flatMap((child) => {
      const clean = sanitizeNode(child, depth + 1);
      return clean ? [clean] : [];
    });
  }
  return result;
}

let cachedSchema: ReturnType<typeof getSchema> | undefined;

/**
 * Reduces untrusted editor JSON to the allowed nodes, marks and attributes and checks that the
 * result is valid against the editor schema, so stored content always renders.
 * Unknown nodes are removed, unsafe links lose the link mark, foreign images are removed.
 * An empty document is stored as `{ type: "doc", content: [] }`.
 */
export function sanitizeDoc(input: unknown): TiptapDoc {
  if (!isObject(input) || input.type !== "doc") throw new InvalidDocumentError("notADocument");
  if (JSON.stringify(input).length > W1_CONTENT_CONFIG.maxDocumentBytes) {
    throw new InvalidDocumentError("tooLarge");
  }
  const content = (Array.isArray(input.content) ? input.content : []).flatMap((child) => {
    const clean = sanitizeNode(child, 1);
    return clean ? [clean] : [];
  });
  const doc: TiptapDoc = { type: "doc", content };
  if (content.length === 0) return doc;
  try {
    cachedSchema ??= getSchema(contentExtensions);
    cachedSchema.nodeFromJSON(doc).check();
  } catch {
    throw new InvalidDocumentError("invalidStructure");
  }
  return isEmptyDoc(doc) ? { type: "doc", content: [] } : doc;
}
