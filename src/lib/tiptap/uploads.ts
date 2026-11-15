import { APP_CONFIG } from "@/config/app";
import type { TiptapDoc } from "@/server/db/schema/custom-types";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** Matches exactly `/api/uploads/<uuid>` (no query, no host, no traversal). */
const UPLOAD_SRC = new RegExp(
  `^${APP_CONFIG.uploads.urlPrefix.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(${UUID})$`,
);

/** The upload id of an image `src`, lower-cased, or null when it is not one of our upload URLs. */
export function parseUploadSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const match = UPLOAD_SRC.exec(src);
  return match?.[1] ? match[1].toLowerCase() : null;
}

export function uploadUrl(id: string): string {
  return `${APP_CONFIG.uploads.urlPrefix}${id}`;
}

function collect(node: unknown, ids: Set<string>): void {
  if (typeof node !== "object" || node === null) return;
  const { type, attrs, content } = node as {
    type?: unknown;
    attrs?: { src?: unknown };
    content?: unknown;
  };
  if (type === "image") {
    const id = parseUploadSrc(attrs?.src);
    if (id) ids.add(id);
  }
  if (Array.isArray(content)) for (const child of content) collect(child, ids);
}

/** Every upload id referenced by an image node of the (already sanitized) documents. */
export function collectUploadIds(...docs: (TiptapDoc | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const doc of docs) collect(doc, ids);
  return [...ids];
}
