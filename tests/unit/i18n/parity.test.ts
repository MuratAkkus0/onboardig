import { describe, expect, it } from "vitest";
import { NAMESPACES } from "@/i18n/namespaces";
import { flattenKeys, readNamespaces } from "./messages";

describe("message files", () => {
  const de = readNamespaces("de");
  const en = readNamespaces("en");

  it("exist for every namespace in both locales", () => {
    expect(Object.keys(de).sort()).toEqual([...NAMESPACES].sort());
    expect(Object.keys(en).sort()).toEqual([...NAMESPACES].sort());
  });

  it.each(NAMESPACES)("has identical key sets in de and en for %s", (namespace) => {
    expect(flattenKeys(en[namespace]).sort()).toEqual(flattenKeys(de[namespace]).sort());
  });
});
