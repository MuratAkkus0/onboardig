import { describe, expect, it } from "vitest";
import { describeError } from "@/server/errors";

describe("describeError", () => {
  it("never exposes the SQL text or bound parameters of a failed query", () => {
    const cause = Object.assign(new Error("connection terminated"), { code: "57P01" });
    const wrapped = new Error(
      "Failed query: update account set password = $1\nparams: scrypt-hash",
      {
        cause,
      },
    );
    wrapped.name = "DrizzleQueryError";
    const described = describeError(wrapped);
    expect(described).toEqual({ name: "DrizzleQueryError", code: "57P01" });
    expect(JSON.stringify(described)).not.toContain("scrypt-hash");
  });

  it("hides the message of a query error without SQLSTATE", () => {
    const wrapped = new Error("Failed query: select 1\nparams: secret@example.test");
    expect(describeError(wrapped)).toEqual({ name: "Error" });
  });

  it("keeps the message of ordinary errors", () => {
    expect(describeError(new TypeError("boom"))).toEqual({ name: "TypeError", message: "boom" });
    expect(describeError("x")).toEqual({ name: "unknown" });
  });
});
