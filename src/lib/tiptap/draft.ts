import { APP_CONFIG } from "@/config/app";

export interface LocalDraft {
  titleDe: string;
  titleEn: string;
  contentDe: unknown;
  contentEn: unknown;
  savedAt: string;
}

const draftKey = (pageId: string): string => `${APP_CONFIG.draftStorageKeyPrefix}${pageId}`;

function isDraft(value: unknown): value is LocalDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.titleDe === "string" &&
    typeof draft.titleEn === "string" &&
    typeof draft.savedAt === "string" &&
    "contentDe" in draft &&
    "contentEn" in draft
  );
}

/** Stores the unsaved editor state in the browser (idle timeout, lost lock). */
export function saveLocalDraft(storage: Storage, pageId: string, draft: LocalDraft): void {
  try {
    storage.setItem(draftKey(pageId), JSON.stringify(draft));
  } catch {
    // storage full or unavailable: nothing more we can do for the draft
  }
}

export function loadLocalDraft(storage: Storage, pageId: string): LocalDraft | null {
  try {
    const raw = storage.getItem(draftKey(pageId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(storage: Storage, pageId: string): void {
  try {
    storage.removeItem(draftKey(pageId));
  } catch {
    // ignore
  }
}
