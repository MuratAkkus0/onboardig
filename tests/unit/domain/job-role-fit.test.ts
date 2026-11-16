import { describe, expect, it } from "vitest";
import {
  filterRolesForDepartment,
  keepFittingRoleId,
  roleFitsDepartment,
} from "@/lib/domain/job-role-fit";

const IT = "dep-it";
const HR = "dep-hr";
const roles = [
  { id: "r-all", departmentId: null },
  { id: "r-it", departmentId: IT },
  { id: "r-hr", departmentId: HR },
];

describe("roleFitsDepartment", () => {
  it("accepts company-wide roles for every target", () => {
    expect(roleFitsDepartment({ departmentId: null }, IT)).toBe(true);
    expect(roleFitsDepartment({ departmentId: null }, null)).toBe(true);
  });

  it("accepts a department role only for its own department", () => {
    expect(roleFitsDepartment({ departmentId: IT }, IT)).toBe(true);
    expect(roleFitsDepartment({ departmentId: IT }, HR)).toBe(false);
  });

  it("rejects a department role for a company-wide target", () => {
    expect(roleFitsDepartment({ departmentId: IT }, null)).toBe(false);
  });
});

describe("filterRolesForDepartment", () => {
  it("returns own and company-wide roles for a department", () => {
    expect(filterRolesForDepartment(roles, IT).map((r) => r.id)).toEqual(["r-all", "r-it"]);
  });

  it("returns only company-wide roles for the 'all' target", () => {
    expect(filterRolesForDepartment(roles, null).map((r) => r.id)).toEqual(["r-all"]);
  });
});

describe("keepFittingRoleId", () => {
  it("keeps a fitting role and clears a role that no longer fits", () => {
    expect(keepFittingRoleId(roles, "r-it", IT)).toBe("r-it");
    expect(keepFittingRoleId(roles, "r-all", HR)).toBe("r-all");
    expect(keepFittingRoleId(roles, "r-it", HR)).toBeNull();
    expect(keepFittingRoleId(roles, "r-it", null)).toBeNull();
  });

  it("clears unknown ids and passes null through", () => {
    expect(keepFittingRoleId(roles, "missing", IT)).toBeNull();
    expect(keepFittingRoleId(roles, null, IT)).toBeNull();
  });
});
