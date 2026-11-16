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
import {
  createEmployee,
  createLead,
  createModule as makeModule,
  createPage,
} from "../../factories";
import { actorOf, testDb } from "../../helpers";
import { adminActor } from "./fixtures";

async function order() {
  const rows = await testDb.select().from(modules);
  return rows.sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.titleDe);
}

describe("modules service", () => {
  it("creates modules in order and normalizes a blank English title", async () => {
    const { actor } = await adminActor();
    const first = await createModule(actor, { titleDe: "Erstes", titleEn: " " });
    const second = await createModule(actor, { titleDe: "Zweites", titleEn: "Second" });
    expect(first.titleEn).toBeNull();
    expect(second.sortOrder).toBe(first.sortOrder + 1);
  });

  it("updates a module and reports NOT_FOUND for unknown ids", async () => {
    const { actor } = await adminActor();
    const mod = await makeModule({ titleDe: "Alt" });
    const updated = await updateModule(actor, { id: mod.id, titleDe: "Neu", titleEn: "New" });
    expect(updated).toMatchObject({ titleDe: "Neu", titleEn: "New" });
    await expect(
      updateModule(actor, { id: "00000000-0000-4000-8000-000000000000", titleDe: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("moves a module up and down, also when sort_order values are equal", async () => {
    const { actor } = await adminActor();
    const a = await makeModule({ titleDe: "A", sortOrder: 0 });
    await makeModule({ titleDe: "B", sortOrder: 0 });
    await makeModule({ titleDe: "C", sortOrder: 0 });
    await moveModule(actor, { id: a.id, direction: "down" });
    expect(await order()).toEqual(["B", "A", "C"]);
    await moveModule(actor, { id: a.id, direction: "down" });
    expect(await order()).toEqual(["B", "C", "A"]);
    // moving past the end is a no-op
    await moveModule(actor, { id: a.id, direction: "down" });
    expect(await order()).toEqual(["B", "C", "A"]);
    await moveModule(actor, { id: a.id, direction: "up" });
    expect(await order()).toEqual(["B", "A", "C"]);
  });

  it("deletes an empty module", async () => {
    const { actor } = await adminActor();
    const mod = await makeModule();
    await deleteModule(actor, { id: mod.id });
    expect(await testDb.select().from(modules).where(eq(modules.id, mod.id))).toHaveLength(0);
  });

  it.each(["draft", "published", "archived"] as const)(
    "refuses to delete a module with a %s page (IN_USE)",
    async (status) => {
      const { actor } = await adminActor();
      const mod = await makeModule();
      await createPage({ moduleId: mod.id, status });
      await expect(deleteModule(actor, { id: mod.id })).rejects.toMatchObject({
        code: "IN_USE",
        details: { reasonKey: "library.errors.moduleHasPages" },
      });
    },
  );

  it("is closed to employees for every write and to leads for reordering", async () => {
    const mod = await makeModule();
    const forbidden = { code: "FORBIDDEN" };
    const employee = actorOf(await createEmployee());
    await expect(createModule(employee, { titleDe: "x" })).rejects.toMatchObject(forbidden);
    await expect(updateModule(employee, { id: mod.id, titleDe: "x" })).rejects.toMatchObject(
      forbidden,
    );
    await expect(moveModule(employee, { id: mod.id, direction: "up" })).rejects.toMatchObject(
      forbidden,
    );
    await expect(deleteModule(employee, { id: mod.id })).rejects.toMatchObject(forbidden);
    await expect(
      moveModule(actorOf(await createLead()), { id: mod.id, direction: "up" }),
    ).rejects.toMatchObject(forbidden);
  });

  it("listModules needs library.read: leads see published pages only, employees nothing", async () => {
    const { actor: admin } = await adminActor();
    const withPublished = await makeModule({ titleDe: "Mit", sortOrder: 0 });
    const onlyDraft = await makeModule({ titleDe: "Entwurf", sortOrder: 1 });
    await createPage({ moduleId: withPublished.id, status: "published", titleDe: "pub" });
    await createPage({ moduleId: withPublished.id, status: "draft", titleDe: "dra" });
    await createPage({ moduleId: onlyDraft.id, status: "draft" });

    const lead = actorOf(await createLead());
    const leadView = await listModules(lead);
    expect(leadView.map((m) => m.titleDe)).toEqual(["Mit"]);
    expect(leadView[0]!.pages.map((p) => p.titleDe)).toEqual(["pub"]);

    const adminView = await listModules(admin);
    expect(adminView.map((m) => m.titleDe)).toEqual(["Mit", "Entwurf"]);
    expect(adminView[0]!.pages.map((p) => p.titleDe).sort()).toEqual(["dra", "pub"]);

    await expect(listModules(actorOf(await createEmployee()))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
