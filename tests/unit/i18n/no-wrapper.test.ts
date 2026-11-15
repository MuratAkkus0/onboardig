import { describe, expect, it } from "vitest";
import { NAMESPACES } from "@/i18n/namespaces";
import { readNamespaces } from "./messages";

describe("namespace files", () => {
  for (const locale of ["de", "en"]) {
    const files = readNamespaces(locale);
    it.each(NAMESPACES)(
      `${locale}/%s has no wrapper key named after its namespace`,
      (namespace) => {
        const keys = Object.keys(files[namespace] ?? {});
        expect(keys.length === 1 && keys[0] === namespace).toBe(false);
      },
    );
  }
});
