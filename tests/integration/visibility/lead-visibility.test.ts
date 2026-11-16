import { describe, expect, it } from "vitest";
import { pages } from "@/server/db/schema";
import { updateModule } from "@/server/services/modules";
import { listLibrary, getPageForView, listPagesForPicker } from "@/server/services/pages";
import { getPlanForUser } from "@/server/services/plans";
import { search } from "@/server/services/search";
import { canViewPageInTx, visiblePagesCondition } from "@/server/services/visibility";
import { assignPlanSteps, createEmployee } from "../../factories";
import { testDb } from "../../helpers";
import { leadFixture } from "../content/lead-fixtures";

type Fixture = Awaited<ReturnType<typeof leadFixture>>;
type Viewer = Fixture["leadA"];

async function visibleIds(actor: Viewer, includeArchived = false) {
  const rows = await testDb
    .select({ id: pages.id })
    .from(pages)
    .where(visiblePagesCondition(actor, { includeArchived }));
  return rows.map((row) => row.id).sort();
}

const ids = (...list: { id: string }[]) => list.map((page) => page.id).sort();

describe("visibility of team leads", () => {
  it("sees published pages plus own-department drafts, archived only with includeArchived", async () => {
    const f = await leadFixture();
    const published = [f.a.published, f.b.published, f.all.published];
    expect(await visibleIds(f.leadA)).toEqual(ids(...published, f.a.draft));
    expect(await visibleIds(f.leadA, true)).toEqual(ids(...published, f.a.draft, f.a.archived));
    expect(await visibleIds(f.leadB)).toEqual(ids(...published, f.b.draft));
    expect(await visibleIds(f.leadB, true)).toEqual(ids(...published, f.b.draft, f.b.archived));
  });

  it("gives a lead without a team published pages only, and employees stay unchanged", async () => {
    const f = await leadFixture();
    const published = ids(f.a.published, f.b.published, f.all.published);
    expect(await visibleIds(f.teamless, true)).toEqual(published);
    expect(await visibleIds(f.employee, true)).toEqual([]);
    await assignPlanSteps(f.employee.id, [
      { pageId: f.a.published.id, phase: "first_day" },
      { pageId: f.a.draft.id, phase: "first_day" },
    ]);
    expect(await visibleIds(f.employee, true)).toEqual([f.a.published.id]);
  });

  it("follows a department change of the module", async () => {
    const f = await leadFixture();
    await updateModule(f.admin, {
      id: f.a.module.id,
      titleDe: "t",
      departmentId: f.departmentB.id,
    });
    expect(await visibleIds(f.leadA)).not.toContain(f.a.draft.id);
    expect(await visibleIds(f.leadB)).toContain(f.a.draft.id);
  });

  it("canViewPageInTx applies the same rule", async () => {
    const f = await leadFixture();
    const check = (actor: Viewer, id: string, includeArchived = false) =>
      testDb.transaction((tx) => canViewPageInTx(tx, actor, id, { includeArchived }));
    expect(await check(f.leadA, f.a.draft.id)).toBe(true);
    expect(await check(f.leadA, f.b.draft.id)).toBe(false);
    expect(await check(f.leadA, f.a.archived.id)).toBe(false);
    expect(await check(f.leadA, f.a.archived.id, true)).toBe(true);
    expect(await check(f.leadA, f.b.archived.id, true)).toBe(false);
    expect(await check(f.teamless, f.a.draft.id)).toBe(false);
  });
});

describe("lead views that follow the rule", () => {
  it("library: own drafts and archived pages, foreign published pages only", async () => {
    const f = await leadFixture();
    const tree = await listLibrary(f.leadA);
    const titles = (moduleId: string) =>
      tree
        .find((m) => m.id === moduleId)
        ?.pages.map((p) => p.status)
        .sort();
    expect(titles(f.a.module.id)).toEqual(["archived", "draft", "published"]);
    expect(titles(f.b.module.id)).toEqual(["published"]);
    expect(titles(f.all.module.id)).toEqual(["published"]);
  });

  it("page view: own draft readable, foreign draft NOT_FOUND", async () => {
    const f = await leadFixture();
    expect((await getPageForView(f.leadA, { id: f.a.draft.id })).status).toBe("draft");
    expect((await getPageForView(f.leadA, { id: f.a.archived.id })).status).toBe("archived");
    await expect(getPageForView(f.leadA, { id: f.b.draft.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getPageForView(f.leadA, { id: f.b.archived.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("search: own-department drafts are found, foreign drafts are not", async () => {
    const f = await leadFixture();
    const hits = async (actor: Viewer) =>
      (await search(actor, { q: "draft" })).pages.map((hit) => hit.pageId).sort();
    expect(await hits(f.leadA)).toEqual([f.a.draft.id]);
    expect(await hits(f.leadB)).toEqual([f.b.draft.id]);
    expect(await hits(f.teamless)).toEqual([]);
  });

  it("template page picker offers own-department drafts but never archived pages", async () => {
    const f = await leadFixture();
    const offered = (await listPagesForPicker(f.leadA)).map((p) => p.id).sort();
    expect(offered).toContain(f.a.draft.id);
    expect(offered).not.toContain(f.b.draft.id);
    expect(offered).not.toContain(f.a.archived.id);
  });

  it("employee plan view: a lead sees titles of own-department drafts only", async () => {
    const f = await leadFixture();
    const trainee = await createEmployee({ leadId: f.leadAUser.id, teamId: f.teamA.id });
    await assignPlanSteps(trainee.id, [
      { pageId: f.a.draft.id, phase: "first_day" },
      { pageId: f.b.draft.id, phase: "first_day" },
      { pageId: f.b.published.id, phase: "first_day" },
    ]);
    const plan = await getPlanForUser(f.leadA, { userId: trainee.id });
    const step = (pageId: string) =>
      plan.phases.flatMap((phase) => phase.steps).find((s) => s.pageId === pageId);
    expect(step(f.a.draft.id)).toMatchObject({ title: f.a.draft.titleDe, pageStatus: "draft" });
    expect(step(f.b.draft.id)).toMatchObject({ title: null, pageStatus: "draft" });
    expect(step(f.b.published.id)?.title).toBe(f.b.published.titleDe);
  });
});
