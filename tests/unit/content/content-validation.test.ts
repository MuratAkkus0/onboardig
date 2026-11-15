import { describe, expect, it } from "vitest";
import "@/lib/validation/common";
import {
  createModuleSchema,
  savePageContentSchema,
  uploadImageSchema,
} from "@/lib/validation/content";
import { doc } from "../../helpers/tiptap";

const id = "11111111-1111-4111-8111-111111111111";
const emptyDoc = { type: "doc" as const, content: [{ type: "paragraph" }] };

function fieldsOf(result: ReturnType<typeof savePageContentSchema.safeParse>) {
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
}

describe("savePageContentSchema", () => {
  it("accepts German only", () => {
    const result = savePageContentSchema.safeParse({
      id,
      titleDe: "Titel",
      titleEn: "",
      contentDe: doc("Text"),
      contentEn: emptyDoc,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.titleEn).toBeNull();
  });

  it("accepts a complete English variant", () => {
    const result = savePageContentSchema.safeParse({
      id,
      titleDe: "Titel",
      titleEn: "Title",
      contentDe: doc("Text"),
      contentEn: doc("Text"),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an English title without English content", () => {
    const result = savePageContentSchema.safeParse({
      id,
      titleDe: "Titel",
      titleEn: "Title",
      contentDe: doc("Text"),
      contentEn: emptyDoc,
    });
    expect(fieldsOf(result)).toEqual(["contentEn:editor.errors.englishIncomplete"]);
  });

  it("rejects English content without an English title", () => {
    const result = savePageContentSchema.safeParse({
      id,
      titleDe: "Titel",
      titleEn: "   ",
      contentDe: doc("Text"),
      contentEn: doc("Text"),
    });
    expect(fieldsOf(result)).toEqual(["titleEn:editor.errors.englishIncomplete"]);
  });

  it("requires a German title", () => {
    const result = savePageContentSchema.safeParse({
      id,
      titleDe: "  ",
      contentDe: doc("Text"),
    });
    expect(fieldsOf(result)).toEqual(["titleDe:validation.required"]);
  });

  it("requires a document shape for the content", () => {
    const result = savePageContentSchema.safeParse({ id, titleDe: "T", contentDe: "text" });
    expect(result.success).toBe(false);
  });
});

describe("module and upload schemas", () => {
  it("turns a blank English module title into null", () => {
    expect(createModuleSchema.parse({ titleDe: " Start ", titleEn: "  " })).toEqual({
      titleDe: "Start",
      titleEn: null,
    });
  });

  it("requires bytes for uploads", () => {
    expect(uploadImageSchema.safeParse({ pageId: id, fileName: "a.png", bytes: "x" }).success).toBe(
      false,
    );
    expect(
      uploadImageSchema.safeParse({ pageId: id, fileName: "a.png", bytes: new Uint8Array(1) })
        .success,
    ).toBe(true);
  });
});
