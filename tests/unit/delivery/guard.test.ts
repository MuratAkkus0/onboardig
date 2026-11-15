import { describe, expect, it } from "vitest";
import { assertSeedAllowed, SeedRefusedError } from "../../../scripts/demo-data/guard";

describe("assertSeedAllowed", () => {
  it("allows an empty database", () => {
    expect(() =>
      assertSeedAllowed({ userCount: 0, reset: false, nodeEnv: "development" }),
    ).not.toThrow();
  });

  it("refuses when users exist and --reset is absent", () => {
    expect(() => assertSeedAllowed({ userCount: 3, reset: false, nodeEnv: "development" })).toThrow(
      SeedRefusedError,
    );
  });

  it("allows --reset on a non-production database with data", () => {
    expect(() =>
      assertSeedAllowed({ userCount: 3, reset: true, nodeEnv: "development" }),
    ).not.toThrow();
  });

  it("refuses --reset in production, even on an empty database", () => {
    expect(() => assertSeedAllowed({ userCount: 0, reset: true, nodeEnv: "production" })).toThrow(
      /production/,
    );
    expect(() => assertSeedAllowed({ userCount: 5, reset: true, nodeEnv: "production" })).toThrow(
      SeedRefusedError,
    );
  });

  it("still seeds an empty production database without --reset", () => {
    expect(() =>
      assertSeedAllowed({ userCount: 0, reset: false, nodeEnv: "production" }),
    ).not.toThrow();
  });
});
