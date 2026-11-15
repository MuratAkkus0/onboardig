import { describe, expect, it } from "vitest";
import { pages } from "@/server/db/schema";
import { canViewPageInTx, visiblePagesCondition } from "@/server/services/visibility";
import {
  assignPlanSteps,
  createAdmin,
  createEmployee,
  createLead,
  createPage,
} from "../../factories";
import { actorOf, testDb } from "../../helpers";

async function fixture() {
  const inPlan = await createPage({ titleDe: "published in plan", status: "published" });
  const notInPlan = await createPage({ titleDe: "published not in plan", status: "published" });
  const draft = await createPage({ titleDe: "draft", status: "draft" });
  const draftInPlan = await createPage({ titleDe: "draft in plan", status: "draft" });
  const archived = await createPage({ titleDe: "archived", status: "archived" });
  const employee = await createEmployee();
  await assignPlanSteps(employee.id, [
    { pageId: inPlan.id, phase: "first_day" },
    { pageId: draftInPlan.id, phase: "first_day" },
  ]);
  return { inPlan, notInPlan, draft, draftInPlan, archived, employee };
}

async function visibleIds(actor: ReturnType<typeof actorOf>, includeArchived = false) {
  const rows = await testDb
    .select({ id: pages.id })
    .from(pages)
    .where(visiblePagesCondition(actor, { includeArchived }));
  return rows.map((row) => row.id).sort();
}

async function viewableIds(
  actor: ReturnType<typeof actorOf>,
  ids: string[],
  includeArchived = false,
) {
  return testDb.transaction(async (tx) => {
    const viewable: string[] = [];
    for (const id of ids) {
      if (await canViewPageInTx(tx, actor, id, { includeArchived })) viewable.push(id);
    }
    return viewable.sort();
  });
}

describe("visibility", () => {
  it("employee sees only published pages of their own plan", async () => {
    const f = await fixture();
    expect(await visibleIds(actorOf(f.employee))).toEqual([f.inPlan.id]);
  });

  it("team lead sees published pages only", async () => {
    const f = await fixture();
    const lead = await createLead();
    expect(await visibleIds(actorOf(lead))).toEqual([f.inPlan.id, f.notInPlan.id].sort());
  });

  it("admin sees draft and published; archived only with includeArchived", async () => {
    const f = await fixture();
    const admin = await createAdmin();
    const base = [f.inPlan.id, f.notInPlan.id, f.draft.id, f.draftInPlan.id].sort();
    expect(await visibleIds(actorOf(admin))).toEqual(base);
    expect(await visibleIds(actorOf(admin), true)).toEqual([...base, f.archived.id].sort());
  });

  it("includeArchived is ignored for non-admins", async () => {
    const f = await fixture();
    const lead = await createLead();
    expect(await visibleIds(actorOf(lead), true)).not.toContain(f.archived.id);
    expect(await visibleIds(actorOf(f.employee), true)).toEqual([f.inPlan.id]);
  });

  it("canViewPageInTx and visiblePagesCondition agree on the same fixture", async () => {
    const f = await fixture();
    const allIds = (await testDb.select({ id: pages.id }).from(pages)).map((row) => row.id);
    expect(allIds).toHaveLength(5);
    const actors = [actorOf(f.employee), actorOf(await createLead()), actorOf(await createAdmin())];
    for (const actor of actors) {
      for (const includeArchived of [false, true]) {
        expect(
          await viewableIds(actor, allIds, includeArchived),
          `${actor.role}/${includeArchived}`,
        ).toEqual(await visibleIds(actor, includeArchived));
      }
    }
  });
});
