import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Actor } from "@/server/auth/types";
import { pages, uploads } from "@/server/db/schema";
import {
  acquireLock,
  getLockState,
  heartbeat,
  releaseLock,
  takeOverLock,
} from "@/server/services/locks";
import {
  changePageStatus,
  createPage,
  deletePage,
  getPageDeletionImpact,
  getPageForEdit,
  movePage,
  movePageToModule,
  savePageContent,
} from "@/server/services/pages";
import { getImageForServing, uploadImage } from "@/server/services/uploads";
import {
  createEmployee,
  createModule as makeModule,
  createPage as makePage,
} from "../../factories";
import { doc, testDb } from "../../helpers";
import { notificationsOf, planWith } from "../plans/fixtures";
import { PNG_BYTES } from "./fixtures";
import { leadFixture } from "./lead-fixtures";

const FORBIDDEN = { code: "FORBIDDEN" };
const NOT_FOUND = { code: "NOT_FOUND" };

const save = (actor: Actor, id: string, title = "Neu") =>
  savePageContent(actor, {
    id,
    titleDe: title,
    titleEn: "",
    contentDe: doc(title),
    contentEn: null,
  });

async function statusOf(id: string) {
  const [row] = await testDb.select().from(pages).where(eq(pages.id, id));
  return row?.status;
}

describe("lead page editing in the own department", () => {
  it("creates, edits and walks through every status transition", async () => {
    const f = await leadFixture();
    const { id } = await createPage(f.leadA, { moduleId: f.a.module.id, titleDe: "Neue Seite" });
    expect((await getPageForEdit(f.leadA, { id })).status).toBe("draft");

    await acquireLock(f.leadA, { pageId: id });
    const saved = await save(f.leadA, id, "Geändert");
    expect(saved.titleDe).toBe("Geändert");

    for (const [action, expected] of [
      ["publish", "published"],
      ["unpublish", "draft"],
      ["publish", "published"],
      ["archive", "archived"],
      ["restore", "published"],
    ] as const) {
      await changePageStatus(f.leadA, { id, action });
      expect(await statusOf(id)).toBe(expected);
    }
  });

  it("edits existing drafts and archived pages of the department, reads the deletion impact", async () => {
    const f = await leadFixture();
    await getPageForEdit(f.leadA, { id: f.a.draft.id });
    await getPageForEdit(f.leadA2, { id: f.a.archived.id });
    expect(await getPageDeletionImpact(f.leadA, { id: f.a.published.id })).toMatchObject({
      used: false,
    });
  });

  it("reorders inside the module and moves pages between own-department modules", async () => {
    const f = await leadFixture();
    const other = await makeModule({ departmentId: f.departmentA.id });
    await movePage(f.leadA, { id: f.a.published.id, direction: "up" });
    await movePageToModule(f.leadA, { id: f.a.draft.id, moduleId: other.id });
    const [moved] = await testDb.select().from(pages).where(eq(pages.id, f.a.draft.id));
    expect(moved?.moduleId).toBe(other.id);
    // Moving into the page's own module is an authorised no-op.
    await movePageToModule(f.leadA, { id: f.a.published.id, moduleId: f.a.module.id });
  });
});

describe("lead page editing outside the own department", () => {
  it("rejects every operation: FORBIDDEN when visible, NOT_FOUND when unseen", async () => {
    const f = await leadFixture();
    const cases: { pageId: string; error: { code: string } }[] = [
      { pageId: f.b.published.id, error: FORBIDDEN },
      { pageId: f.all.published.id, error: FORBIDDEN },
      { pageId: f.b.draft.id, error: NOT_FOUND },
      { pageId: f.b.archived.id, error: NOT_FOUND },
      { pageId: f.all.draft.id, error: NOT_FOUND },
    ];
    for (const { pageId, error } of cases) {
      await expect(getPageForEdit(f.leadA, { id: pageId })).rejects.toMatchObject(error);
      await expect(save(f.leadA, pageId)).rejects.toMatchObject(error);
      await expect(
        changePageStatus(f.leadA, { id: pageId, action: "archive" }),
      ).rejects.toMatchObject(error);
      await expect(movePage(f.leadA, { id: pageId, direction: "up" })).rejects.toMatchObject(error);
      await expect(
        movePageToModule(f.leadA, { id: pageId, moduleId: f.a.module.id }),
      ).rejects.toMatchObject(error);
      await expect(getPageDeletionImpact(f.leadA, { id: pageId })).rejects.toMatchObject(error);
    }
    await expect(
      createPage(f.leadA, { moduleId: f.b.module.id, titleDe: "x" }),
    ).rejects.toMatchObject(FORBIDDEN);
    await expect(
      createPage(f.leadA, { moduleId: f.all.module.id, titleDe: "x" }),
    ).rejects.toMatchObject(FORBIDDEN);
    expect(await statusOf(f.b.published.id)).toBe("published");
  });

  it("requires both modules to be editable when moving between modules", async () => {
    const f = await leadFixture();
    await expect(
      movePageToModule(f.leadA, { id: f.a.draft.id, moduleId: f.b.module.id }),
    ).rejects.toMatchObject(FORBIDDEN);
    await expect(
      movePageToModule(f.leadA, { id: f.a.draft.id, moduleId: f.all.module.id }),
    ).rejects.toMatchObject(FORBIDDEN);
    const [row] = await testDb.select().from(pages).where(eq(pages.id, f.a.draft.id));
    expect(row?.moduleId).toBe(f.a.module.id);
  });

  it("gives a lead without a team no editing rights at all", async () => {
    const f = await leadFixture();
    await expect(getPageForEdit(f.teamless, { id: f.a.published.id })).rejects.toMatchObject(
      FORBIDDEN,
    );
    await expect(getPageForEdit(f.teamless, { id: f.a.draft.id })).rejects.toMatchObject(NOT_FOUND);
    await expect(
      createPage(f.teamless, { moduleId: f.a.module.id, titleDe: "x" }),
    ).rejects.toMatchObject(FORBIDDEN);
    await expect(acquireLock(f.teamless, { pageId: f.a.published.id })).rejects.toMatchObject(
      FORBIDDEN,
    );
  });

  it("keeps employees out entirely", async () => {
    const f = await leadFixture();
    await expect(getPageForEdit(f.employee, { id: f.a.published.id })).rejects.toMatchObject(
      FORBIDDEN,
    );
    await expect(
      createPage(f.employee, { moduleId: f.a.module.id, titleDe: "x" }),
    ).rejects.toMatchObject(FORBIDDEN);
  });

  it("loses access when an admin moves the page to another department", async () => {
    const f = await leadFixture();
    await movePageToModule(f.admin, { id: f.a.published.id, moduleId: f.b.module.id });
    await expect(getPageForEdit(f.leadA, { id: f.a.published.id })).rejects.toMatchObject(
      FORBIDDEN,
    );
  });
});

describe("hard delete is admin only", () => {
  it("rejects leads in their own department, lets admins delete", async () => {
    const f = await leadFixture();
    await expect(deletePage(f.leadA, { id: f.a.draft.id })).rejects.toMatchObject(FORBIDDEN);
    expect(await statusOf(f.a.draft.id)).toBe("draft");
    await expect(deletePage(f.admin, { id: f.a.draft.id })).resolves.toEqual({ result: "deleted" });
  });
});

describe("locks between leads and admins", () => {
  it("acquire, heartbeat, takeover and save work across lead and admin", async () => {
    const f = await leadFixture();
    const pageId = f.a.draft.id;
    await acquireLock(f.leadA, { pageId });
    await expect(acquireLock(f.admin, { pageId })).rejects.toMatchObject({
      code: "LOCK_HELD",
      details: { holderName: expect.any(String) },
    });
    await expect(heartbeat(f.leadA, { pageId })).resolves.toMatchObject({ held: true });
    expect((await getLockState(f.admin, { pageId })).holder?.id).toBe(f.leadA.id);

    const taken = await takeOverLock(f.admin, { pageId });
    expect(taken.isMine).toBe(true);
    await expect(save(f.leadA, pageId)).rejects.toMatchObject({ code: "LOCK_LOST" });
    await save(f.admin, pageId, "Admin");

    await takeOverLock(f.leadA, { pageId });
    await save(f.leadA, pageId, "Lead");
    // Another lead of the same department may take over as well.
    await takeOverLock(f.leadA2, { pageId });
    await releaseLock(f.leadA2, { pageId });
    expect((await getLockState(f.leadA, { pageId })).holder).toBeNull();
  });

  it("a lead of another department or without a team cannot use locks", async () => {
    const f = await leadFixture();
    const cases = [
      { actor: f.leadB, pageId: f.a.published.id, error: FORBIDDEN },
      { actor: f.leadB, pageId: f.a.draft.id, error: NOT_FOUND },
      { actor: f.teamless, pageId: f.a.published.id, error: FORBIDDEN },
    ];
    for (const { actor, pageId, error } of cases) {
      await expect(acquireLock(actor, { pageId })).rejects.toMatchObject(error);
      await expect(takeOverLock(actor, { pageId })).rejects.toMatchObject(error);
      await expect(getLockState(actor, { pageId })).rejects.toMatchObject(error);
      await expect(releaseLock(actor, { pageId })).rejects.toMatchObject(error);
    }
    await acquireLock(f.leadA, { pageId: f.a.draft.id });
    await expect(heartbeat(f.leadB, { pageId: f.a.draft.id })).resolves.toMatchObject({
      held: false,
    });
    await expect(heartbeat(f.leadB, { pageId: f.a.published.id })).rejects.toMatchObject(FORBIDDEN);
    // The foreign attempts neither stole nor released the lock.
    expect((await getLockState(f.admin, { pageId: f.a.draft.id })).holder?.id).toBe(f.leadA.id);
  });

  it("answers NOT_FOUND for unknown pages", async () => {
    const f = await leadFixture();
    await expect(
      acquireLock(f.leadA, { pageId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject(NOT_FOUND);
  });
});

describe("uploads", () => {
  it("lets a lead upload to an editable page and serves it", async () => {
    const f = await leadFixture();
    const upload = await uploadImage(f.leadA, {
      pageId: f.a.draft.id,
      fileName: "x.png",
      bytes: PNG_BYTES,
    });
    const [row] = await testDb.select().from(uploads).where(eq(uploads.id, upload.id));
    expect(row).toMatchObject({ pageId: f.a.draft.id, uploadedBy: f.leadA.id });
    expect((await getImageForServing(f.leadA2, { id: upload.id })).mimeType).toBe("image/png");
    await expect(getImageForServing(f.leadB, { id: upload.id })).rejects.toMatchObject(NOT_FOUND);
    await expect(getImageForServing(f.employee, { id: upload.id })).rejects.toMatchObject(
      NOT_FOUND,
    );
  });

  it("rejects pages the lead cannot edit and stores nothing", async () => {
    const f = await leadFixture();
    const attempt = (actor: Actor, pageId: string) =>
      uploadImage(actor, { pageId, fileName: "x.png", bytes: PNG_BYTES });
    await expect(attempt(f.leadA, f.b.published.id)).rejects.toMatchObject(FORBIDDEN);
    await expect(attempt(f.leadA, f.all.published.id)).rejects.toMatchObject(FORBIDDEN);
    await expect(attempt(f.leadA, f.b.draft.id)).rejects.toMatchObject(NOT_FOUND);
    await expect(attempt(f.teamless, f.a.published.id)).rejects.toMatchObject(FORBIDDEN);
    expect(await testDb.select().from(uploads)).toHaveLength(0);
  });
});

describe("notifications for lead edits", () => {
  it("a lead save of a published page sends page_updated like an admin save", async () => {
    const f = await leadFixture();
    const holder = await createEmployee();
    await planWith(holder.id, [f.a.published.id]);
    await acquireLock(f.leadA, { pageId: f.a.published.id });
    await save(f.leadA, f.a.published.id, "Aktualisiert");
    const received = await notificationsOf(holder.id, "page_updated");
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      pageId: f.a.published.id,
      params: { titleDe: "Aktualisiert", titleEn: null },
    });
  });

  it("a lead save of a draft page sends nothing", async () => {
    const f = await leadFixture();
    const holder = await createEmployee();
    const draft = await makePage({ moduleId: f.a.module.id, status: "draft" });
    await planWith(holder.id, [draft.id]);
    await acquireLock(f.leadA, { pageId: draft.id });
    await save(f.leadA, draft.id);
    expect(await notificationsOf(holder.id, "page_updated")).toHaveLength(0);
  });
});
