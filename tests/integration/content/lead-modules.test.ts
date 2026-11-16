import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { modules } from "@/server/db/schema";
import {
  createModule,
  deleteModule,
  listModules,
  moveModule,
  updateModule,
} from "@/server/services/modules";
import { deleteDepartment, getDepartmentUsage } from "@/server/services/org";
import { createDepartment, createModule as makeModule } from "../../factories";
import { testDb } from "../../helpers";
import { leadFixture } from "./lead-fixtures";

const FORBIDDEN = { code: "FORBIDDEN" };
const NOT_FOUND = { code: "NOT_FOUND" };

async function departmentOf(id: string) {
  const [row] = await testDb.select().from(modules).where(eq(modules.id, id));
  return row?.departmentId;
}

describe("createModule", () => {
  it("forces the lead's department and rejects naming another one", async () => {
    const f = await leadFixture();
    const created = await createModule(f.leadA, { titleDe: "Neu" });
    expect(created.departmentId).toBe(f.departmentA.id);
    const same = await createModule(f.leadA, { titleDe: "Neu 2", departmentId: f.departmentA.id });
    expect(same.departmentId).toBe(f.departmentA.id);
    await expect(
      createModule(f.leadA, { titleDe: "x", departmentId: f.departmentB.id }),
    ).rejects.toMatchObject(FORBIDDEN);
    await expect(
      createModule(f.leadA, { titleDe: "x", departmentId: null }),
    ).resolves.toMatchObject({ departmentId: f.departmentA.id });
  });

  it("lets admins pick any department or none and validates the department", async () => {
    const f = await leadFixture();
    expect((await createModule(f.admin, { titleDe: "a" })).departmentId).toBeNull();
    expect(
      (await createModule(f.admin, { titleDe: "b", departmentId: f.departmentB.id })).departmentId,
    ).toBe(f.departmentB.id);
    await expect(
      createModule(f.admin, { titleDe: "c", departmentId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("is closed to a lead without a team and to employees", async () => {
    const f = await leadFixture();
    await expect(createModule(f.teamless, { titleDe: "x" })).rejects.toMatchObject(FORBIDDEN);
    await expect(createModule(f.employee, { titleDe: "x" })).rejects.toMatchObject(FORBIDDEN);
  });
});

describe("updateModule", () => {
  it("lets a lead rename an own-department module but not change its department", async () => {
    const f = await leadFixture();
    const row = await updateModule(f.leadA, { id: f.a.module.id, titleDe: "Umbenannt" });
    expect(row).toMatchObject({ titleDe: "Umbenannt", departmentId: f.departmentA.id });
    // The unchanged department may be repeated; any other value is FORBIDDEN.
    await updateModule(f.leadA, {
      id: f.a.module.id,
      titleDe: "Umbenannt",
      departmentId: f.departmentA.id,
    });
    for (const departmentId of [f.departmentB.id, null]) {
      await expect(
        updateModule(f.leadA, { id: f.a.module.id, titleDe: "x", departmentId }),
      ).rejects.toMatchObject(FORBIDDEN);
    }
    expect(await departmentOf(f.a.module.id)).toBe(f.departmentA.id);
  });

  it("answers FORBIDDEN for visible foreign and company-wide modules, NOT_FOUND for unseen ones", async () => {
    const f = await leadFixture();
    for (const id of [f.b.module.id, f.all.module.id]) {
      await expect(updateModule(f.leadA, { id, titleDe: "x" })).rejects.toMatchObject(FORBIDDEN);
    }
    const hidden = await makeModule({ departmentId: f.departmentB.id });
    await expect(updateModule(f.leadA, { id: hidden.id, titleDe: "x" })).rejects.toMatchObject(
      NOT_FOUND,
    );
    await expect(
      updateModule(f.leadA, { id: "00000000-0000-4000-8000-000000000000", titleDe: "x" }),
    ).rejects.toMatchObject(NOT_FOUND);
  });

  it("lets only admins set, change and clear the department", async () => {
    const f = await leadFixture();
    await updateModule(f.admin, {
      id: f.all.module.id,
      titleDe: "t",
      departmentId: f.departmentA.id,
    });
    expect(await departmentOf(f.all.module.id)).toBe(f.departmentA.id);
    await updateModule(f.admin, {
      id: f.all.module.id,
      titleDe: "t",
      departmentId: f.departmentB.id,
    });
    expect(await departmentOf(f.all.module.id)).toBe(f.departmentB.id);
    // undefined keeps it, null makes the module company-wide
    await updateModule(f.admin, { id: f.all.module.id, titleDe: "t2" });
    expect(await departmentOf(f.all.module.id)).toBe(f.departmentB.id);
    await updateModule(f.admin, { id: f.all.module.id, titleDe: "t", departmentId: null });
    expect(await departmentOf(f.all.module.id)).toBeNull();
    await expect(
      updateModule(f.admin, {
        id: f.all.module.id,
        titleDe: "t",
        departmentId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("a lead loses access once an admin hands the module to another department", async () => {
    const f = await leadFixture();
    await updateModule(f.admin, {
      id: f.a.module.id,
      titleDe: "t",
      departmentId: f.departmentB.id,
    });
    await expect(updateModule(f.leadA, { id: f.a.module.id, titleDe: "x" })).rejects.toMatchObject(
      FORBIDDEN,
    );
  });
});

describe("deleteModule", () => {
  it("lets a lead delete an empty own-department module only", async () => {
    const f = await leadFixture();
    const empty = await createModule(f.leadA, { titleDe: "leer" });
    await deleteModule(f.leadA, { id: empty.id });
    expect(await testDb.select().from(modules).where(eq(modules.id, empty.id))).toHaveLength(0);
    await expect(deleteModule(f.leadA, { id: f.a.module.id })).rejects.toMatchObject({
      code: "IN_USE",
    });
  });

  it("rejects foreign, company-wide and unseen modules for leads", async () => {
    const f = await leadFixture();
    await expect(deleteModule(f.leadA, { id: f.b.module.id })).rejects.toMatchObject(FORBIDDEN);
    await expect(deleteModule(f.leadA, { id: f.all.module.id })).rejects.toMatchObject(FORBIDDEN);
    const emptyForeign = await makeModule({ departmentId: f.departmentB.id });
    await expect(deleteModule(f.leadA, { id: emptyForeign.id })).rejects.toMatchObject(NOT_FOUND);
    await expect(deleteModule(f.teamless, { id: f.a.module.id })).rejects.toMatchObject(FORBIDDEN);
    await deleteModule(f.admin, { id: emptyForeign.id });
  });
});

describe("moveModule", () => {
  it("is admin only", async () => {
    const f = await leadFixture();
    await expect(
      moveModule(f.leadA, { id: f.a.module.id, direction: "down" }),
    ).rejects.toMatchObject(FORBIDDEN);
    await moveModule(f.admin, { id: f.a.module.id, direction: "down" });
  });
});

describe("listModules for leads", () => {
  it("returns owner department and edit flags, including own empty modules", async () => {
    const f = await leadFixture();
    const empty = await createModule(f.leadA, { titleDe: "leer" });
    const emptyForeign = await makeModule({
      departmentId: f.departmentB.id,
      titleDe: "fremd leer",
    });

    const tree = await listModules(f.leadA);
    const byId = new Map(tree.map((m) => [m.id, m]));
    expect(byId.has(emptyForeign.id)).toBe(false);
    expect(byId.get(empty.id)).toMatchObject({ canEdit: true, departmentName: "Dept A" });
    expect(byId.get(f.a.module.id)).toMatchObject({
      canEdit: true,
      departmentId: f.departmentA.id,
    });
    expect(byId.get(f.b.module.id)).toMatchObject({ canEdit: false, departmentName: "Dept B" });
    expect(byId.get(f.all.module.id)).toMatchObject({ canEdit: false, departmentId: null });
    expect(byId.get(f.a.module.id)?.pages.every((p) => p.canEdit)).toBe(true);
    expect(byId.get(f.b.module.id)?.pages.some((p) => p.canEdit)).toBe(false);

    const adminTree = await listModules(f.admin);
    expect(adminTree.every((m) => m.canEdit)).toBe(true);
    const teamlessTree = await listModules(f.teamless);
    expect(teamlessTree.some((m) => m.canEdit)).toBe(false);
  });
});

describe("department usage", () => {
  it("counts owned modules as usage and blocks deleting the department", async () => {
    const f = await leadFixture();
    const owner = await createDepartment({ name: "Nur Module" });
    const owned = await makeModule({ departmentId: owner.id, titleDe: "Eigenes Modul" });
    const usage = await getDepartmentUsage(f.admin, { id: owner.id });
    expect(usage).toMatchObject({ used: true, modules: [{ id: owned.id, name: "Eigenes Modul" }] });
    await expect(deleteDepartment(f.admin, { id: owner.id })).rejects.toMatchObject({
      code: "IN_USE",
      details: { modules: [{ id: owned.id, name: "Eigenes Modul" }] },
    });
  });
});
