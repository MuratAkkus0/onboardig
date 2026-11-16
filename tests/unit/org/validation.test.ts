import { describe, expect, it } from "vitest";
import { W1_ORG_CONFIG } from "@/config/app";
import {
  createDepartmentSchema,
  createJobRoleSchema,
  createTeamSchema,
  updateTeamSchema,
} from "@/lib/validation/org";

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("org validation", () => {
  it("trims names", () => {
    expect(createDepartmentSchema.parse({ name: "  IT  " })).toEqual({ name: "IT" });
    expect(createJobRoleSchema.parse({ name: " Designer ", departmentId: null })).toEqual({
      name: "Designer",
      departmentId: null,
    });
  });

  it("rejects blank and over-long names with i18n keys", () => {
    const blank = createDepartmentSchema.safeParse({ name: "   " });
    expect(blank.success ? [] : blank.error.issues.map((i) => i.message)).toEqual([
      "validation.required",
    ]);
    const long = createJobRoleSchema.safeParse({
      name: "x".repeat(W1_ORG_CONFIG.nameMaxLength + 1),
      departmentId: null,
    });
    expect(long.success ? [] : long.error.issues.map((i) => i.message)).toEqual([
      "validation.tooLong",
    ]);
  });

  it("requires a department id or null for job roles", () => {
    expect(createJobRoleSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(createJobRoleSchema.safeParse({ name: "A", departmentId: "nope" }).success).toBe(false);
    expect(createJobRoleSchema.safeParse({ name: "A", departmentId: ID }).success).toBe(true);
    expect(createJobRoleSchema.safeParse({ name: "A", departmentId: null }).success).toBe(true);
  });

  it("requires ids to be uuids", () => {
    expect(createTeamSchema.safeParse({ departmentId: "nope", name: "A" }).success).toBe(false);
    expect(createTeamSchema.safeParse({ departmentId: ID, name: "A" }).success).toBe(true);
    expect(updateTeamSchema.safeParse({ id: ID, name: "A" }).success).toBe(false);
  });
});
