import { describe, expect, it } from "vitest";
import { hasEnglish, hasEnglishEvent, isEmptyDoc } from "@/lib/domain/locale-content";
import { doc } from "../../helpers/tiptap";

describe("isEmptyDoc", () => {
  it("treats empty and whitespace-only documents as empty", () => {
    expect(isEmptyDoc(null)).toBe(true);
    expect(isEmptyDoc({ type: "doc", content: [] })).toBe(true);
    expect(isEmptyDoc(doc("", "   "))).toBe(true);
  });

  it("detects text and images", () => {
    expect(isEmptyDoc(doc("Hello"))).toBe(false);
    expect(
      isEmptyDoc({ type: "doc", content: [{ type: "image", attrs: { src: "/api/uploads/x" } }] }),
    ).toBe(false);
  });
});

describe("hasEnglish", () => {
  it("needs a title and non-empty content", () => {
    expect(hasEnglish({ titleEn: "Title", contentEn: doc("Body") })).toBe(true);
    expect(hasEnglish({ titleEn: "  ", contentEn: doc("Body") })).toBe(false);
    expect(hasEnglish({ titleEn: "Title", contentEn: doc("") })).toBe(false);
    expect(hasEnglish({ titleEn: "Title", contentEn: null })).toBe(false);
    expect(hasEnglish({ titleEn: null, contentEn: null })).toBe(false);
  });
});

describe("hasEnglishEvent", () => {
  it("needs title and description", () => {
    expect(hasEnglishEvent({ titleEn: "Kickoff", descriptionEn: "Welcome" })).toBe(true);
    expect(hasEnglishEvent({ titleEn: "Kickoff", descriptionEn: " " })).toBe(false);
    expect(hasEnglishEvent({ titleEn: null, descriptionEn: null })).toBe(false);
  });
});
