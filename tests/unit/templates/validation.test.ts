import { describe, expect, it } from "vitest";
import { W2_TEMPLATES_CONFIG } from "@/config/app";
import {
  addTemplateStepSchema,
  createTemplateSchema,
  deleteTemplateSchema,
  moveTemplateStepSchema,
  updateTemplateSchema,
} from "@/lib/validation/templates";

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OTHER = "0b9d4a52-6f3c-4c0e-9d1a-3f5a7a2c8e11";

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
}

describe("template validation", () => {
  it("requires a department: missing, blank or garbage is rejected", () => {
    expect(messages(createTemplateSchema.safeParse({ name: "A" }))).toEqual([
      "validation.required",
    ]);
    for (const departmentId of ["", "everyone", null]) {
      expect(createTemplateSchema.safeParse({ name: "A", departmentId }).success).toBe(false);
    }
  });

  it("accepts a department id or the company-wide marker", () => {
    expect(createTemplateSchema.parse({ name: "A", departmentId: "all" }).departmentId).toBe("all");
    expect(createTemplateSchema.parse({ name: "A", departmentId: ID }).departmentId).toBe(ID);
  });

  it("trims the name and normalises optional fields to null", () => {
    expect(createTemplateSchema.parse({ name: "  IT Basics ", departmentId: "all" })).toEqual({
      name: "IT Basics",
      description: null,
      departmentId: "all",
      teamId: null,
      jobRoleId: null,
    });
    const parsed = createTemplateSchema.parse({
      name: "A",
      description: "  text ",
      departmentId: ID,
      teamId: OTHER,
      jobRoleId: null,
    });
    expect(parsed).toMatchObject({ description: "text", teamId: OTHER, jobRoleId: null });
  });

  it("rejects blank and over-long names and descriptions", () => {
    expect(messages(createTemplateSchema.safeParse({ name: "  ", departmentId: "all" }))).toEqual([
      "validation.required",
    ]);
    expect(
      messages(
        createTemplateSchema.safeParse({
          name: "x".repeat(W2_TEMPLATES_CONFIG.nameMaxLength + 1),
          departmentId: "all",
        }),
      ),
    ).toEqual(["validation.tooLong"]);
    expect(
      messages(
        createTemplateSchema.safeParse({
          name: "A",
          departmentId: "all",
          description: "x".repeat(W2_TEMPLATES_CONFIG.descriptionMaxLength + 1),
        }),
      ),
    ).toEqual(["validation.tooLong"]);
  });

  it("update needs an id and also a department", () => {
    expect(updateTemplateSchema.safeParse({ name: "A", departmentId: "all" }).success).toBe(false);
    expect(updateTemplateSchema.safeParse({ id: ID, name: "A" }).success).toBe(false);
    expect(updateTemplateSchema.safeParse({ id: ID, name: "A", departmentId: "all" }).success).toBe(
      true,
    );
  });

  it("validates step inputs", () => {
    expect(
      addTemplateStepSchema.safeParse({ templateId: ID, pageId: OTHER, phase: "first_day" })
        .success,
    ).toBe(true);
    expect(
      addTemplateStepSchema.safeParse({ templateId: ID, pageId: OTHER, phase: "later" }).success,
    ).toBe(false);
    expect(moveTemplateStepSchema.safeParse({ stepId: ID, direction: "sideways" }).success).toBe(
      false,
    );
    expect(deleteTemplateSchema.parse({ id: ID }).confirmName).toBeUndefined();
  });
});
