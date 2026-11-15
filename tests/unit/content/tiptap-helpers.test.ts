import { describe, expect, it } from "vitest";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "@/lib/tiptap/draft";
import { isAllowedHref } from "@/lib/tiptap/links";
import { collectUploadIds, parseUploadSrc, uploadUrl } from "@/lib/tiptap/uploads";
import { APP_CONFIG } from "@/config/app";
import { doc } from "../../helpers/tiptap";

const ID_A = "3f2b8f0e-9d1c-4c55-8a5e-0d6f4d2b9c11";
const ID_B = "4a2b8f0e-9d1c-4c55-8a5e-0d6f4d2b9c22";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe("isAllowedHref", () => {
  it("allows only http, https and mailto", () => {
    expect(isAllowedHref("https://example.com")).toBe(true);
    expect(isAllowedHref("http://example.com")).toBe(true);
    expect(isAllowedHref("mailto:a@example.com")).toBe(true);
    expect(isAllowedHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedHref("tel:123")).toBe(false);
    expect(isAllowedHref("example.com")).toBe(false);
    expect(isAllowedHref("https://exa\nmple.com")).toBe(false);
    expect(isAllowedHref("")).toBe(false);
  });
});

describe("upload references", () => {
  it("parses only exact upload urls", () => {
    expect(parseUploadSrc(`${APP_CONFIG.uploads.urlPrefix}${ID_A}`)).toBe(ID_A);
    expect(parseUploadSrc(`${APP_CONFIG.uploads.urlPrefix}${ID_A}#x`)).toBeNull();
    expect(parseUploadSrc(`https://example.com${APP_CONFIG.uploads.urlPrefix}${ID_A}`)).toBeNull();
    expect(parseUploadSrc(undefined)).toBeNull();
    expect(uploadUrl(ID_A)).toBe(`${APP_CONFIG.uploads.urlPrefix}${ID_A}`);
  });

  it("collects the image ids of nested documents once", () => {
    const image = (id: string) => ({ type: "image", attrs: { src: uploadUrl(id) } });
    const content = {
      type: "doc" as const,
      content: [image(ID_A), { type: "blockquote", content: [image(ID_B), image(ID_A)] }],
    };
    expect(collectUploadIds(content, null, doc("x")).sort()).toEqual([ID_A, ID_B].sort());
  });
});

describe("local draft storage", () => {
  const draft = {
    titleDe: "T",
    titleEn: "",
    contentDe: doc("a"),
    contentEn: doc(""),
    savedAt: "2026-11-15T10:00:00.000Z",
  };

  it("round-trips a draft under the configured key prefix", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    saveLocalDraft(storage, "p1", draft);
    expect(storage.getItem(`${APP_CONFIG.draftStorageKeyPrefix}p1`)).not.toBeNull();
    expect(loadLocalDraft(storage, "p1")).toEqual(draft);
    clearLocalDraft(storage, "p1");
    expect(loadLocalDraft(storage, "p1")).toBeNull();
  });

  it("ignores corrupt entries", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    storage.setItem(`${APP_CONFIG.draftStorageKeyPrefix}p1`, "{not json");
    expect(loadLocalDraft(storage, "p1")).toBeNull();
    storage.setItem(`${APP_CONFIG.draftStorageKeyPrefix}p1`, JSON.stringify({ titleDe: 1 }));
    expect(loadLocalDraft(storage, "p1")).toBeNull();
  });
});
