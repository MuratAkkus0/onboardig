import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { pages, templateSteps, uploads } from "@/server/db/schema";
import { acquireLock, takeOverLock } from "@/server/services/locks";
import {
  changePageStatus,
  createPage,
  deletePage,
  getPageDeletionImpact,
  getPageForEdit,
  getPageForView,
  listLibrary,
  listPagesForPicker,
  movePage,
  movePageToModule,
  savePageContent,
} from "@/server/services/pages";
import { uploadImage } from "@/server/services/uploads";
import { getStorage } from "@/server/storage";
import {
  assignPlanSteps,
  completePage,
  createAdmin,
  createEmployee,
  createLead,
  createModule,
  createPage as makePage,
  createTemplate,
} from "../../factories";
import { actorOf, doc, expireLock, minutesAgo, testDb } from "../../helpers";
import { adminActor, PNG_BYTES } from "./fixtures";

const hooks = vi.hoisted(() => ({
  onPublishedPageContentChanged: vi.fn(),
  onPageStatusChanged: vi.fn(),
}));
vi.mock("@/server/services/plan-hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/plan-hooks")>()),
  ...hooks,
}));

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

beforeEach(() => {
  hooks.onPublishedPageContentChanged.mockClear();
  hooks.onPageStatusChanged.mockClear();
});

async function pageRow(id: string) {
  const [row] = await testDb.select().from(pages).where(eq(pages.id, id));
  return row;
}

async function editorFixture(status: "draft" | "published" = "draft") {
  const admin = await adminActor();
  const page = await makePage({ status });
  await acquireLock(admin.actor, { pageId: page.id });
  return { ...admin, page };
}

const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };

describe("createPage", () => {
  it("creates an empty draft at the end of the module", async () => {
    const { actor } = await adminActor();
    const mod = await createModule();
    const first = await createPage(actor, { moduleId: mod.id, titleDe: "Eins" });
    const second = await createPage(actor, { moduleId: mod.id, titleDe: "Zwei" });
    const [a, b] = [await pageRow(first.id), await pageRow(second.id)];
    expect(a).toMatchObject({ status: "draft", titleDe: "Eins", textDe: "", updatedBy: null });
    expect(a!.contentDe).toEqual({ type: "doc", content: [] });
    expect(b!.sortOrder).toBe(a!.sortOrder + 1);
  });

  it("answers NOT_FOUND for an unknown module and VALIDATION for a blank title", async () => {
    const { actor } = await adminActor();
    await expect(createPage(actor, { moduleId: UNKNOWN_ID, titleDe: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const mod = await createModule();
    await expect(createPage(actor, { moduleId: mod.id, titleDe: "  " })).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe("page state machine", () => {
  it("walks draft -> published -> draft -> archived -> published and calls the hook each time", async () => {
    const { actor, user } = await adminActor();
    const page = await makePage({ status: "draft" });
    const steps = [
      ["publish", "published", "draft"],
      ["unpublish", "draft", "published"],
      ["archive", "archived", "draft"],
      ["restore", "published", "archived"],
    ] as const;
    for (const [action, to, from] of steps) {
      const result = await changePageStatus(actor, { id: page.id, action });
      expect(result.status).toBe(to);
      expect(hooks.onPageStatusChanged).toHaveBeenLastCalledWith(expect.anything(), {
        pageId: page.id,
        from,
        to,
        actorId: user.id,
      });
    }
    expect(hooks.onPageStatusChanged).toHaveBeenCalledTimes(4);
  });

  it("rejects transitions the machine does not allow", async () => {
    const { actor } = await adminActor();
    const archived = await makePage({ status: "archived" });
    const published = await makePage({ status: "published" });
    await expect(
      changePageStatus(actor, { id: archived.id, action: "publish" }),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await expect(
      changePageStatus(actor, { id: published.id, action: "restore" }),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    expect(hooks.onPageStatusChanged).not.toHaveBeenCalled();
    expect((await pageRow(archived.id))!.status).toBe("archived");
  });

  it("exposes the allowed actions in the edit dto", async () => {
    const { actor } = await adminActor();
    const page = await makePage({ status: "published" });
    expect((await getPageForEdit(actor, { id: page.id })).allowedActions.sort()).toEqual([
      "archive",
      "unpublish",
    ]);
  });

  it("is closed to employees", async () => {
    const page = await makePage();
    await expect(
      changePageStatus(actorOf(await createEmployee()), { id: page.id, action: "publish" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("savePageContent", () => {
  const input = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    titleDe: "Urlaubsregelung",
    titleEn: "",
    contentDe: doc("Urlaub beantragen Sie rechtzeitig."),
    contentEn: emptyDoc,
    ...extra,
  });

  it("is rejected with LOCK_LOST without a lock, with an expired lock and with a foreign lock", async () => {
    const owner = await adminActor();
    const other = await adminActor();
    const page = await makePage();
    await expect(savePageContent(owner.actor, input(page.id))).rejects.toMatchObject({
      code: "LOCK_LOST",
    });
    await acquireLock(owner.actor, { pageId: page.id });
    await expect(savePageContent(other.actor, input(page.id))).rejects.toMatchObject({
      code: "LOCK_LOST",
    });
    await expireLock(page.id);
    await expect(savePageContent(owner.actor, input(page.id))).rejects.toMatchObject({
      code: "LOCK_LOST",
    });
    // the save path never re-acquires
    await expect(savePageContent(owner.actor, input(page.id))).rejects.toMatchObject({
      code: "LOCK_LOST",
    });
    expect((await pageRow(page.id))!.titleDe).not.toBe("Urlaubsregelung");
  });

  it("is rejected after another admin took the lock over", async () => {
    const { actor, page } = await editorFixture();
    const other = await adminActor();
    await takeOverLock(other.actor, { pageId: page.id });
    await expect(savePageContent(actor, input(page.id))).rejects.toMatchObject({
      code: "LOCK_LOST",
    });
  });

  it("answers NOT_FOUND for an unknown page", async () => {
    const { actor } = await adminActor();
    await expect(savePageContent(actor, input(UNKNOWN_ID))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("stores content, extracted text and fills the search vectors", async () => {
    const { actor, page } = await editorFixture();
    const dto = await savePageContent(actor, input(page.id));
    expect(dto.titleDe).toBe("Urlaubsregelung");
    const row = (await pageRow(page.id))!;
    expect(row.textDe).toBe("Urlaub beantragen Sie rechtzeitig.");
    expect(row.contentDe).toEqual(doc("Urlaub beantragen Sie rechtzeitig."));
    const result = await testDb.execute<{ de: boolean; titleHit: boolean; en: boolean }>(sql`
      select search_de @@ websearch_to_tsquery('german', 'Urlaubs') as de,
             search_de @@ websearch_to_tsquery('german', 'Urlaubsregelung') as "titleHit",
             search_en @@ websearch_to_tsquery('english', 'Urlaub') as en
      from pages where id = ${page.id}`);
    expect(result.rows[0]).toEqual({ de: true, titleHit: true, en: false });
  });

  it("normalizes an absent English variant to all null (title, content and text)", async () => {
    const { actor, page } = await editorFixture();
    await savePageContent(actor, input(page.id, { titleEn: "  ", contentEn: emptyDoc }));
    expect(await pageRow(page.id)).toMatchObject({ titleEn: null, contentEn: null, textEn: null });
    await savePageContent(actor, input(page.id, { titleEn: null, contentEn: null }));
    expect(await pageRow(page.id)).toMatchObject({ titleEn: null, contentEn: null, textEn: null });
  });

  it("stores a complete English variant and its text", async () => {
    const { actor, page } = await editorFixture();
    await savePageContent(
      actor,
      input(page.id, { titleEn: "Leave policy", contentEn: doc("Request leave early.") }),
    );
    const row = (await pageRow(page.id))!;
    expect(row).toMatchObject({ titleEn: "Leave policy", textEn: "Request leave early." });
    const result = await testDb.execute<{ en: boolean }>(
      sql`select search_en @@ websearch_to_tsquery('english', 'requesting') as en from pages where id = ${page.id}`,
    );
    expect(result.rows[0]!.en).toBe(true);
  });

  it("rejects an English title without English content (zod) and the reverse", async () => {
    const { actor, page } = await editorFixture();
    await expect(
      savePageContent(actor, input(page.id, { titleEn: "Title", contentEn: emptyDoc })),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      savePageContent(actor, input(page.id, { titleEn: "", contentEn: doc("Content") })),
    ).rejects.toBeInstanceOf(ZodError);
    expect((await pageRow(page.id))!.titleEn).toBeNull();
  });

  it("rejects an English variant that sanitizing empties", async () => {
    const { actor, page } = await editorFixture();
    const onlyUnknown = {
      type: "doc",
      content: [{ type: "script", content: [{ type: "text", text: "x" }] }],
    };
    await expect(
      savePageContent(actor, input(page.id, { titleEn: "Title", contentEn: onlyUnknown })),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("sanitizes content before storing it", async () => {
    const { actor, page } = await editorFixture();
    const dirty = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hallo",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        { type: "iframe", attrs: { src: "https://evil.example" } },
      ],
    };
    await savePageContent(actor, input(page.id, { contentDe: dirty }));
    expect((await pageRow(page.id))!.contentDe).toEqual(doc("Hallo"));
  });

  it("rejects content the editor schema cannot hold with a field error", async () => {
    const { actor, page } = await editorFixture();
    const broken = { type: "doc", content: [{ type: "text", text: "loose" }] };
    await expect(
      savePageContent(actor, input(page.id, { contentDe: broken })),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: { fieldErrors: { contentDe: ["editor.errors.invalidContent"] } },
    });
  });

  describe("last edited", () => {
    it("sets content_updated_at and updated_by on save, and moves leave them alone", async () => {
      const { actor, user, page } = await editorFixture();
      const mod = await createModule();
      const before = (await pageRow(page.id))!;
      expect(before.updatedBy).toBeNull();
      await savePageContent(actor, input(page.id));
      const saved = (await pageRow(page.id))!;
      expect(saved.updatedBy).toBe(user.id);
      expect(saved.contentUpdatedAt.getTime()).toBeGreaterThanOrEqual(
        before.contentUpdatedAt.getTime(),
      );

      await movePage(actor, { id: page.id, direction: "down" });
      await movePageToModule(actor, { id: page.id, moduleId: mod.id });
      await changePageStatus(actor, { id: page.id, action: "publish" });
      const after = (await pageRow(page.id))!;
      expect(after.contentUpdatedAt.getTime()).toBe(saved.contentUpdatedAt.getTime());
      expect(after.updatedBy).toBe(user.id);
      expect(after.moduleId).toBe(mod.id);

      const dto = await getPageForEdit(actor, { id: page.id });
      expect(dto.lastEditedAt.getTime()).toBe(saved.contentUpdatedAt.getTime());
      expect(dto.lastEditedByName).toBe(user.name);
    });
  });

  describe("plan hooks", () => {
    it("calls onPublishedPageContentChanged for published pages only", async () => {
      const draft = await editorFixture("draft");
      await savePageContent(draft.actor, input(draft.page.id));
      expect(hooks.onPublishedPageContentChanged).not.toHaveBeenCalled();

      const published = await editorFixture("published");
      await savePageContent(published.actor, input(published.page.id));
      expect(hooks.onPublishedPageContentChanged).toHaveBeenCalledWith(expect.anything(), {
        pageId: published.page.id,
        actorId: published.user.id,
      });
    });

    it("rolls the save back when the hook fails", async () => {
      const { actor, page } = await editorFixture("published");
      hooks.onPublishedPageContentChanged.mockRejectedValueOnce(new Error("boom"));
      await expect(savePageContent(actor, input(page.id))).rejects.toThrow("boom");
      expect((await pageRow(page.id))!.titleDe).toBe(page.titleDe);
    });
  });

  describe("images", () => {
    const image = (src: string) => ({ type: "image", attrs: { src, alt: "" } });
    const withImage = (src: string) => ({
      type: "doc",
      content: [image(src), ...doc("Text").content!],
    });

    it("accepts the page's own upload", async () => {
      const { actor, page } = await editorFixture();
      const own = await uploadImage(actor, {
        pageId: page.id,
        fileName: "a.png",
        bytes: PNG_BYTES,
      });
      await expect(
        savePageContent(actor, input(page.id, { contentDe: withImage(own.url) })),
      ).resolves.toBeDefined();
    });

    it("rejects an upload of another page with editor.errors.foreignImage", async () => {
      const { actor, page } = await editorFixture();
      const otherPage = await makePage();
      const foreign = await uploadImage(actor, {
        pageId: otherPage.id,
        fileName: "a.png",
        bytes: PNG_BYTES,
      });
      await expect(
        savePageContent(actor, input(page.id, { contentDe: withImage(foreign.url) })),
      ).rejects.toMatchObject({
        code: "VALIDATION",
        details: { reasonKey: "editor.errors.foreignImage" },
      });
      // also inside the English variant
      await expect(
        savePageContent(actor, input(page.id, { titleEn: "T", contentEn: withImage(foreign.url) })),
      ).rejects.toMatchObject({ details: { reasonKey: "editor.errors.foreignImage" } });
    });

    it("rejects an upload without a page and an unknown upload id", async () => {
      const { actor, page } = await editorFixture();
      const upload = await uploadImage(actor, {
        pageId: page.id,
        fileName: "a.png",
        bytes: PNG_BYTES,
      });
      await testDb.update(uploads).set({ pageId: null }).where(eq(uploads.id, upload.id));
      for (const src of [upload.url, `/api/uploads/${UNKNOWN_ID}`]) {
        await expect(
          savePageContent(actor, input(page.id, { contentDe: withImage(src) })),
        ).rejects.toMatchObject({ details: { reasonKey: "editor.errors.foreignImage" } });
      }
    });
  });

  it("is closed to employees", async () => {
    const page = await makePage();
    await expect(
      savePageContent(actorOf(await createEmployee()), input(page.id)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("ordering", () => {
  async function titlesOf(moduleId: string) {
    const rows = await testDb.select().from(pages).where(eq(pages.moduleId, moduleId));
    return rows.sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.titleDe);
  }

  it("moves pages up and down inside their module", async () => {
    const { actor } = await adminActor();
    const mod = await createModule();
    const a = await makePage({ moduleId: mod.id, titleDe: "A", sortOrder: 0 });
    await makePage({ moduleId: mod.id, titleDe: "B", sortOrder: 0 });
    await makePage({ moduleId: mod.id, titleDe: "C", sortOrder: 0 });
    await movePage(actor, { id: a.id, direction: "down" });
    expect(await titlesOf(mod.id)).toEqual(["B", "A", "C"]);
    await movePage(actor, { id: a.id, direction: "up" });
    expect(await titlesOf(mod.id)).toEqual(["A", "B", "C"]);
    await movePage(actor, { id: a.id, direction: "up" });
    expect(await titlesOf(mod.id)).toEqual(["A", "B", "C"]);
  });

  it("moves a page to the end of another module", async () => {
    const { actor } = await adminActor();
    const source = await createModule();
    const target = await createModule();
    const moved = await makePage({ moduleId: source.id, titleDe: "moved" });
    await makePage({ moduleId: target.id, titleDe: "t1", sortOrder: 0 });
    await makePage({ moduleId: target.id, titleDe: "t2", sortOrder: 1 });
    await movePageToModule(actor, { id: moved.id, moduleId: target.id });
    expect(await titlesOf(target.id)).toEqual(["t1", "t2", "moved"]);
    expect(await titlesOf(source.id)).toEqual([]);
    await expect(
      movePageToModule(actor, { id: moved.id, moduleId: UNKNOWN_ID }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("delete or archive", () => {
  async function setup(status: "draft" | "published" = "published") {
    const admin = await adminActor();
    const page = await makePage({ status, titleDe: "Brandschutz" });
    return { ...admin, page };
  }

  it("hard-deletes an unused page and its files", async () => {
    const { actor, page } = await setup();
    const upload = await uploadImage(actor, {
      pageId: page.id,
      fileName: "a.png",
      bytes: PNG_BYTES,
    });
    const [row] = await testDb.select().from(uploads).where(eq(uploads.id, upload.id));
    expect(await getPageDeletionImpact(actor, { id: page.id })).toEqual({
      used: false,
      templateCount: 0,
      planCount: 0,
      activePlanCount: 0,
      completionCount: 0,
    });
    expect(await deletePage(actor, { id: page.id })).toEqual({ result: "deleted" });
    expect(await pageRow(page.id)).toBeUndefined();
    expect(await testDb.select().from(uploads).where(eq(uploads.id, upload.id))).toHaveLength(0);
    expect(await getStorage().get(row!.storageKey)).toBeNull();
    expect(hooks.onPageStatusChanged).not.toHaveBeenCalled();
  });

  it("archives a page that is only used by a template step", async () => {
    const { actor, user, page } = await setup();
    await createTemplate({ steps: [{ pageId: page.id, phase: "first_day" }] });
    expect(await getPageDeletionImpact(actor, { id: page.id })).toMatchObject({
      used: true,
      templateCount: 1,
      planCount: 0,
      completionCount: 0,
    });
    expect(await deletePage(actor, { id: page.id, confirmName: "Brandschutz" })).toEqual({
      result: "archived",
    });
    expect((await pageRow(page.id))!.status).toBe("archived");
    expect(hooks.onPageStatusChanged).toHaveBeenCalledWith(expect.anything(), {
      pageId: page.id,
      from: "published",
      to: "archived",
      actorId: user.id,
    });
  });

  it("archives a page that is only in the plan of an archived user", async () => {
    const { actor, page } = await setup();
    const archivedUser = await createEmployee({ onboardingStatus: "archived" });
    await assignPlanSteps(archivedUser.id, [{ pageId: page.id, phase: "first_week" }]);
    expect(await getPageDeletionImpact(actor, { id: page.id })).toMatchObject({
      used: true,
      planCount: 1,
      activePlanCount: 0,
      templateCount: 0,
    });
    expect(await deletePage(actor, { id: page.id, confirmName: "Brandschutz" })).toEqual({
      result: "archived",
    });
  });

  it("archives a page that only has a completion record", async () => {
    const { actor, page } = await setup();
    const employee = await createEmployee();
    await completePage(employee.id, page.id);
    expect(await getPageDeletionImpact(actor, { id: page.id })).toMatchObject({
      used: true,
      planCount: 0,
      completionCount: 1,
    });
    expect(await deletePage(actor, { id: page.id, confirmName: "Brandschutz" })).toEqual({
      result: "archived",
    });
    expect(await pageRow(page.id)).toBeDefined();
  });

  it("counts active plans separately from all plans", async () => {
    const { actor, page } = await setup();
    const active = await createEmployee();
    const completed = await createEmployee({ onboardingStatus: "completed" });
    const archived = await createEmployee({ onboardingStatus: "archived" });
    for (const user of [active, completed, archived]) {
      await assignPlanSteps(user.id, [{ pageId: page.id, phase: "first_day" }]);
    }
    await createTemplate({ steps: [{ pageId: page.id, phase: "first_day" }] });
    await createTemplate({ steps: [{ pageId: page.id, phase: "first_day" }] });
    expect(await getPageDeletionImpact(actor, { id: page.id })).toEqual({
      used: true,
      templateCount: 2,
      planCount: 3,
      activePlanCount: 2,
      completionCount: 0,
    });
  });

  it("needs the exact title to archive a used page and archives drafts too", async () => {
    const { actor, page } = await setup("draft");
    await createTemplate({ steps: [{ pageId: page.id, phase: "first_day" }] });
    for (const confirmName of [undefined, "", "brandschutz", "Brandschutz "]) {
      await expect(deletePage(actor, { id: page.id, confirmName })).rejects.toMatchObject({
        code: "VALIDATION",
        details: { reasonKey: "library.errors.confirmNameMismatch" },
      });
    }
    expect((await pageRow(page.id))!.status).toBe("draft");
    expect(await deletePage(actor, { id: page.id, confirmName: "Brandschutz" })).toEqual({
      result: "archived",
    });
  });

  it("refuses to delete an archived page that is still used", async () => {
    const { actor, page } = await setup();
    await createTemplate({ steps: [{ pageId: page.id, phase: "first_day" }] });
    await deletePage(actor, { id: page.id, confirmName: "Brandschutz" });
    await expect(
      deletePage(actor, { id: page.id, confirmName: "Brandschutz" }),
    ).rejects.toMatchObject({
      code: "IN_USE",
    });
  });

  it("deletes an unused archived page", async () => {
    const { actor } = await setup();
    const page = await makePage({ status: "archived" });
    expect(await deletePage(actor, { id: page.id })).toEqual({ result: "deleted" });
  });

  it("restores an archived page and the deleted-after-restore path stays consistent", async () => {
    const { actor, page } = await setup();
    await createTemplate({ steps: [{ pageId: page.id, phase: "first_day" }] });
    await deletePage(actor, { id: page.id, confirmName: "Brandschutz" });
    expect((await changePageStatus(actor, { id: page.id, action: "restore" })).status).toBe(
      "published",
    );
  });

  it("reports a reference inserted during the delete as CONFLICT pageBecameUsed", async () => {
    const { actor, page } = await setup();
    const template = await createTemplate();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inserted!: () => void;
    const stepInserted = new Promise<void>((resolve) => {
      inserted = resolve;
    });
    // An uncommitted template step: invisible to the usage check, but its FK lock blocks the DELETE.
    const competitor = testDb.transaction(async (tx) => {
      await tx
        .insert(templateSteps)
        .values({ templateId: template.id, pageId: page.id, phase: "first_day", sortOrder: 0 });
      inserted();
      await hold;
    });
    await stepInserted;
    const deletion = deletePage(actor, { id: page.id }).then(
      () => null,
      (error: unknown) => error,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await competitor;
    expect(await deletion).toMatchObject({
      code: "CONFLICT",
      details: { reasonKey: "library.errors.pageBecameUsed" },
    });
    expect(await pageRow(page.id)).toBeDefined();
    // the retry takes the archive path
    expect(await deletePage(actor, { id: page.id, confirmName: "Brandschutz" })).toEqual({
      result: "archived",
    });
  });

  it("is admin only and answers NOT_FOUND for unknown pages", async () => {
    const { actor, page } = await setup();
    await expect(deletePage(actor, { id: UNKNOWN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getPageDeletionImpact(actor, { id: UNKNOWN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    for (const user of [await createEmployee(), await createLead()]) {
      await expect(deletePage(actorOf(user), { id: page.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    await expect(
      getPageDeletionImpact(actorOf(await createEmployee()), { id: page.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("getPageForView", () => {
  const bilingual = () =>
    makePage({
      status: "published",
      titleDe: "Willkommen",
      titleEn: "Welcome",
      contentDe: doc("Hallo"),
      contentEn: doc("Hello"),
      textDe: "Hallo",
      textEn: "Hello",
    });

  it("returns the German variant to German users", async () => {
    const page = await bilingual();
    const lead = actorOf(await createLead({ locale: "de" }));
    expect(await getPageForView(lead, { id: page.id })).toMatchObject({
      title: "Willkommen",
      content: doc("Hallo"),
      isFallback: false,
      status: "published",
    });
  });

  it("returns the English variant to English users when it exists", async () => {
    const page = await bilingual();
    const lead = actorOf(await createLead({ locale: "en" }));
    expect(await getPageForView(lead, { id: page.id })).toMatchObject({
      title: "Welcome",
      content: doc("Hello"),
      isFallback: false,
    });
  });

  it("falls back to German with isFallback for English users without an English variant", async () => {
    const page = await makePage({
      status: "published",
      titleDe: "Nur deutsch",
      contentDe: doc("Text"),
    });
    const lead = actorOf(await createLead({ locale: "en" }));
    expect(await getPageForView(lead, { id: page.id })).toMatchObject({
      title: "Nur deutsch",
      content: doc("Text"),
      isFallback: true,
    });
  });

  it("includes last edited at and by from the content save", async () => {
    const editor = await createAdmin({ firstName: "Eva", lastName: "Editor", name: "Eva Editor" });
    const at = minutesAgo(5);
    const page = await makePage({
      status: "published",
      updatedBy: editor.id,
      contentUpdatedAt: at,
    });
    const view = await getPageForView(actorOf(await createLead()), { id: page.id });
    expect(view.lastEditedByName).toBe("Eva Editor");
    expect(view.lastEditedAt.getTime()).toBe(at.getTime());
  });

  it("shows an employee only published pages of their own plan", async () => {
    const employee = await createEmployee();
    const actor = actorOf(employee);
    const inPlan = await makePage({ status: "published" });
    const notInPlan = await makePage({ status: "published" });
    const draftInPlan = await makePage({ status: "draft" });
    const archivedInPlan = await makePage({ status: "archived" });
    await assignPlanSteps(employee.id, [
      { pageId: inPlan.id, phase: "first_day" },
      { pageId: draftInPlan.id, phase: "first_day" },
      { pageId: archivedInPlan.id, phase: "first_day" },
    ]);
    await expect(getPageForView(actor, { id: inPlan.id })).resolves.toBeDefined();
    for (const page of [notInPlan, draftInPlan, archivedInPlan]) {
      await expect(getPageForView(actor, { id: page.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });

  it("shows leads published pages only and admins every page including archived", async () => {
    const draft = await makePage({ status: "draft" });
    const archived = await makePage({ status: "archived" });
    const published = await makePage({ status: "published" });
    const lead = actorOf(await createLead());
    const admin = actorOf(await createAdmin());
    await expect(getPageForView(lead, { id: published.id })).resolves.toBeDefined();
    for (const page of [draft, archived]) {
      await expect(getPageForView(lead, { id: page.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(getPageForView(admin, { id: page.id })).resolves.toBeDefined();
    }
    await expect(getPageForView(admin, { id: UNKNOWN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("listLibrary and listPagesForPicker", () => {
  async function fixture() {
    const first = await createModule({ titleDe: "Modul 1", sortOrder: 0 });
    const second = await createModule({ titleDe: "Modul 2", titleEn: "Module 2", sortOrder: 1 });
    await makePage({ moduleId: first.id, status: "draft", titleDe: "d", sortOrder: 0 });
    await makePage({
      moduleId: first.id,
      status: "published",
      titleDe: "p",
      titleEn: "pe",
      contentEn: doc("e"),
      textEn: "e",
      sortOrder: 1,
    });
    await makePage({ moduleId: second.id, status: "archived", titleDe: "a" });
  }

  it("gives leads published pages regardless of the status input", async () => {
    await fixture();
    const lead = actorOf(await createLead());
    for (const input of [{}, { status: "draft" as const }, { status: "archived" as const }]) {
      const library = await listLibrary(lead, input);
      expect(library.map((m) => m.titleDe)).toEqual(["Modul 1"]);
      expect(library[0]!.pages.map((p) => p.titleDe)).toEqual(["p"]);
    }
  });

  it("gives admins every page and honours the status filter", async () => {
    await fixture();
    const admin = actorOf(await createAdmin());
    const all = await listLibrary(admin);
    expect(all.flatMap((m) => m.pages.map((p) => p.titleDe))).toEqual(["d", "p", "a"]);
    const drafts = await listLibrary(admin, { status: "draft" });
    expect(drafts.map((m) => [m.titleDe, m.pages.map((p) => p.titleDe)])).toEqual([
      ["Modul 1", ["d"]],
      ["Modul 2", []],
    ]);
  });

  it("resolves titles by locale and flags the missing English title", async () => {
    await fixture();
    const en = actorOf(await createLead({ locale: "en" }));
    const [mod] = await listLibrary(en);
    expect(mod!.pages[0]).toMatchObject({ title: "pe", hasEnglish: true, isFallback: false });
    const de = actorOf(await createLead({ locale: "de" }));
    expect((await listLibrary(de))[0]!.pages[0]).toMatchObject({ title: "p", isFallback: false });
  });

  it("is not available to employees", async () => {
    await expect(listLibrary(actorOf(await createEmployee()))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listPagesForPicker(actorOf(await createEmployee()))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("offers the picker non-archived pages to admins and published pages to leads", async () => {
    await fixture();
    const admin = await listPagesForPicker(actorOf(await createAdmin()));
    expect(admin.map((p) => [p.title, p.moduleTitle, p.status])).toEqual([
      ["d", "Modul 1", "draft"],
      ["p", "Modul 1", "published"],
    ]);
    const lead = await listPagesForPicker(actorOf(await createLead()));
    expect(lead.map((p) => p.title)).toEqual(["p"]);
  });
});

describe("authorization of reads", () => {
  it("getPageForEdit and createPage are closed to employees", async () => {
    const page = await makePage();
    const user = await createEmployee();
    await expect(getPageForEdit(actorOf(user), { id: page.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      createPage(actorOf(user), { moduleId: page.moduleId, titleDe: "x" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
