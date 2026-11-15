import { describe, expect, it } from "vitest";
import {
  createUserSchema,
  listUsersSchema,
  requiredFieldsFor,
  updateUserSchema,
} from "@/lib/validation/users";

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OTHER_ID = "2f1c1f5e-95d3-4a43-8b85-0a5a6f7d0f11";

const base = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", locale: "de" };
const full = { ...base, teamId: ID, jobRoleId: ID, leadId: OTHER_ID, startDate: "2026-12-01" };

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => String(issue.path[0])).sort();
}

describe("createUserSchema", () => {
  it("normalizes e-mail and empty selects", () => {
    const parsed = createUserSchema.parse({
      ...base,
      email: "  Ada@Example.TEST ",
      role: "admin",
      teamId: "",
      jobRoleId: null,
    });
    expect(parsed).toMatchObject({
      email: "ada@example.test",
      teamId: null,
      jobRoleId: null,
      leadId: null,
      startDate: null,
    });
  });

  it("requires all four org fields for employees", () => {
    expect(issuePaths(createUserSchema.safeParse({ ...base, role: "employee" }))).toEqual([
      "jobRoleId",
      "leadId",
      "startDate",
      "teamId",
    ]);
    expect(createUserSchema.safeParse({ ...full, role: "employee" }).success).toBe(true);
  });

  it("does not require a lead for team leads", () => {
    const withoutLead = { ...full, leadId: undefined, role: "team_lead" };
    expect(createUserSchema.safeParse(withoutLead).success).toBe(true);
    expect(
      issuePaths(createUserSchema.safeParse({ ...base, role: "team_lead", startDate: "" })),
    ).toEqual(["jobRoleId", "startDate", "teamId"]);
  });

  it("requires nothing extra for admins", () => {
    expect(createUserSchema.safeParse({ ...base, role: "admin" }).success).toBe(true);
  });

  it("emits i18n keys and rejects invalid values", () => {
    const result = createUserSchema.safeParse({ ...base, role: "employee" });
    expect(result.error?.issues.every((i) => i.message === "validation.required")).toBe(true);
    expect(createUserSchema.safeParse({ ...full, role: "boss" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...full, role: "employee", email: "nope" }).success).toBe(
      false,
    );
    expect(createUserSchema.safeParse({ ...full, role: "employee", locale: "fr" }).success).toBe(
      false,
    );
  });

  it("accepts only real calendar dates", () => {
    const check = (startDate: string) =>
      createUserSchema.safeParse({ ...full, role: "employee", startDate }).success;
    expect(check("2026-02-28")).toBe(true);
    expect(check("2026-02-30")).toBe(false);
    expect(check("01.12.2026")).toBe(false);
    expect(check("2026-1-1")).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("needs the id and applies the same role rules", () => {
    expect(updateUserSchema.safeParse({ ...full, role: "employee" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ ...full, role: "employee", id: ID }).success).toBe(true);
    expect(issuePaths(updateUserSchema.safeParse({ ...base, role: "employee", id: ID }))).toEqual([
      "jobRoleId",
      "leadId",
      "startDate",
      "teamId",
    ]);
  });
});

describe("requiredFieldsFor", () => {
  it("mirrors the blueprint matrix", () => {
    expect(requiredFieldsFor("employee")).toEqual(["teamId", "jobRoleId", "leadId", "startDate"]);
    expect(requiredFieldsFor("team_lead")).toEqual(["teamId", "jobRoleId", "startDate"]);
    expect(requiredFieldsFor("admin")).toEqual([]);
  });
});

describe("listUsersSchema", () => {
  it("accepts an empty filter and drops a blank search", () => {
    expect(listUsersSchema.parse({})).toEqual({ q: undefined });
    expect(listUsersSchema.parse({ q: "   " }).q).toBeUndefined();
    expect(listUsersSchema.parse({ q: " ada " }).q).toBe("ada");
  });

  it("rejects unknown status and role values", () => {
    expect(listUsersSchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ role: "boss" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ teamId: "x" }).success).toBe(false);
  });
});
