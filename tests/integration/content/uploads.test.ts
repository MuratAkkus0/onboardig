import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_CONFIG } from "@/config/app";
import { env } from "@/config/env";
import type { Actor } from "@/server/auth/types";
import { uploads } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { getImageForServing, uploadImage } from "@/server/services/uploads";
import { assignPlanSteps, createEmployee, createLead, createPage } from "../../factories";
import { actorOf, testDb } from "../../helpers";
import { adminActor, PDF_BYTES, PNG_BYTES } from "./fixtures";

const getActor = vi.hoisted(() => vi.fn<() => Promise<Actor | null>>());
vi.mock("@/server/auth/actor", () => ({ getActor }));

const { GET } = await import("@/app/api/uploads/[uploadId]/route");
const { POST } = await import("@/app/api/uploads/route");

async function bytesOf(stream: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function getRequest(id: string) {
  return new NextRequest(`http://localhost/api/uploads/${id}`);
}

async function postRequest(
  form: FormData,
  origin: string | null = new URL(env.APP_URL).origin,
  contentLength?: number,
) {
  // Browsers send Content-Length for multipart bodies; the route requires it.
  const length = contentLength ?? (await new Response(form).arrayBuffer()).byteLength;
  return new NextRequest("http://localhost/api/uploads", {
    method: "POST",
    body: form,
    headers: { ...(origin ? { origin } : {}), "content-length": String(length) },
  });
}

beforeEach(() => getActor.mockReset());

describe("uploadImage", () => {
  it("stores a png for a page and records it", async () => {
    const { actor, user } = await adminActor();
    const page = await createPage();
    const result = await uploadImage(actor, {
      pageId: page.id,
      fileName: "foto.png",
      bytes: PNG_BYTES,
    });
    expect(result.url).toBe(`${APP_CONFIG.uploads.urlPrefix}${result.id}`);
    const [row] = await testDb.select().from(uploads).where(eq(uploads.id, result.id));
    expect(row).toMatchObject({
      pageId: page.id,
      mimeType: "image/png",
      sizeBytes: PNG_BYTES.byteLength,
      uploadedBy: user.id,
      originalName: "foto.png",
    });
    expect(row!.storageKey).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    const stored = await getStorage().get(row!.storageKey);
    expect(await bytesOf(stored!.stream)).toEqual(PNG_BYTES);
  });

  it("sanitizes the original name and detects the type from the bytes, not the name", async () => {
    const { actor } = await adminActor();
    const page = await createPage();
    const result = await uploadImage(actor, {
      pageId: page.id,
      fileName: "../../etc/pass\u0000wd.pdf",
      bytes: PNG_BYTES,
    });
    const [row] = await testDb.select().from(uploads).where(eq(uploads.id, result.id));
    expect(row!.originalName).toBe("passwd.pdf");
    expect(row!.mimeType).toBe("image/png");
  });

  it("rejects files above the size limit", async () => {
    const { actor } = await adminActor();
    const page = await createPage();
    const bytes = new Uint8Array(APP_CONFIG.uploads.maxBytes + 1);
    bytes.set(PNG_BYTES);
    await expect(
      uploadImage(actor, { pageId: page.id, fileName: "x.png", bytes }),
    ).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
    });
    expect(await testDb.select().from(uploads)).toHaveLength(0);
  });

  it("rejects disallowed types even when the name says png", async () => {
    const { actor } = await adminActor();
    const page = await createPage();
    for (const bytes of [PDF_BYTES, new TextEncoder().encode("just text"), new Uint8Array(0)]) {
      await expect(
        uploadImage(actor, { pageId: page.id, fileName: "x.png", bytes }),
      ).rejects.toMatchObject({
        code: "FILE_TYPE_NOT_ALLOWED",
      });
    }
    expect(await testDb.select().from(uploads)).toHaveLength(0);
  });

  it("answers NOT_FOUND for an unknown page and FORBIDDEN for non-admins", async () => {
    const { actor } = await adminActor();
    await expect(
      uploadImage(actor, {
        pageId: "00000000-0000-4000-8000-000000000000",
        fileName: "x.png",
        bytes: PNG_BYTES,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const page = await createPage();
    for (const user of [await createEmployee(), await createLead()]) {
      await expect(
        uploadImage(actorOf(user), { pageId: page.id, fileName: "x.png", bytes: PNG_BYTES }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("getImageForServing", () => {
  async function fixture(status: "draft" | "published" = "published") {
    const { actor: admin } = await adminActor();
    const page = await createPage({ status });
    const upload = await uploadImage(admin, {
      pageId: page.id,
      fileName: "x.png",
      bytes: PNG_BYTES,
    });
    return { admin, page, upload };
  }

  it("serves every upload to admins, including drafts and uploads without a page", async () => {
    const { admin, upload, page } = await fixture("draft");
    const served = await getImageForServing(admin, { id: upload.id });
    expect(served).toMatchObject({ mimeType: "image/png", sizeBytes: PNG_BYTES.byteLength });
    expect(await bytesOf(served.stream)).toEqual(PNG_BYTES);

    await testDb.update(uploads).set({ pageId: null }).where(eq(uploads.id, upload.id));
    await expect(getImageForServing(admin, { id: upload.id })).resolves.toBeDefined();
    expect(page.id).toBeDefined();
  });

  it("serves an employee the images of a published page in their plan only", async () => {
    const { upload, page } = await fixture();
    const employee = await createEmployee();
    const actor = actorOf(employee);
    await expect(getImageForServing(actor, { id: upload.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await assignPlanSteps(employee.id, [{ pageId: page.id, phase: "first_day" }]);
    await expect(getImageForServing(actor, { id: upload.id })).resolves.toBeDefined();
  });

  it("hides images of draft pages from employees and leads", async () => {
    const { upload, page } = await fixture("draft");
    const employee = await createEmployee();
    await assignPlanSteps(employee.id, [{ pageId: page.id, phase: "first_day" }]);
    for (const actor of [actorOf(employee), actorOf(await createLead())]) {
      await expect(getImageForServing(actor, { id: upload.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });

  it("lets a lead read images of published pages", async () => {
    const { upload } = await fixture();
    await expect(
      getImageForServing(actorOf(await createLead()), { id: upload.id }),
    ).resolves.toBeDefined();
  });

  it("answers NOT_FOUND for uploads without a page (non-admins) and unknown ids", async () => {
    const { upload } = await fixture();
    await testDb.update(uploads).set({ pageId: null }).where(eq(uploads.id, upload.id));
    const lead = actorOf(await createLead());
    await expect(getImageForServing(lead, { id: upload.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      getImageForServing(lead, { id: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("answers NOT_FOUND when the file is gone from storage", async () => {
    const { admin, upload } = await fixture();
    const [row] = await testDb.select().from(uploads).where(eq(uploads.id, upload.id));
    await getStorage().delete(row!.storageKey);
    await expect(getImageForServing(admin, { id: upload.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("GET /api/uploads/[uploadId]", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ uploadId: id }) });

  it("answers 401 without a session", async () => {
    getActor.mockResolvedValue(null);
    const response = await GET(
      getRequest("00000000-0000-4000-8000-000000000000"),
      ctx("00000000-0000-4000-8000-000000000000"),
    );
    expect(response.status).toBe(401);
  });

  it("answers 404 to an employee who does not have the page in the plan", async () => {
    const { actor: admin } = await adminActor();
    const page = await createPage({ status: "published" });
    const upload = await uploadImage(admin, {
      pageId: page.id,
      fileName: "x.png",
      bytes: PNG_BYTES,
    });
    getActor.mockResolvedValue(actorOf(await createEmployee()));
    const response = await GET(getRequest(upload.id), ctx(upload.id));
    expect(response.status).toBe(404);
  });

  it("streams the image with the security headers", async () => {
    const { actor: admin } = await adminActor();
    const page = await createPage({ status: "published" });
    const upload = await uploadImage(admin, {
      pageId: page.id,
      fileName: "x.png",
      bytes: PNG_BYTES,
    });
    const employee = await createEmployee();
    await assignPlanSteps(employee.id, [{ pageId: page.id, phase: "first_day" }]);
    getActor.mockResolvedValue(actorOf(employee));
    const response = await GET(getRequest(upload.id), ctx(upload.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(PNG_BYTES.byteLength));
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });
});

describe("POST /api/uploads", () => {
  function form(page: string, bytes: Uint8Array, name = "x.png") {
    const data = new FormData();
    data.set("file", new File([bytes as BlobPart], name, { type: "image/png" }));
    data.set("pageId", page);
    return data;
  }
  const ctx = { params: Promise.resolve({}) };

  it("answers 401 without a session", async () => {
    getActor.mockResolvedValue(null);
    const page = await createPage();
    expect((await POST(await postRequest(form(page.id, PNG_BYTES)), ctx)).status).toBe(401);
  });

  it("answers 403 for a request from a foreign origin", async () => {
    const { actor } = await adminActor();
    getActor.mockResolvedValue(actor);
    const page = await createPage();
    expect(
      (await POST(await postRequest(form(page.id, PNG_BYTES), "https://evil.example"), ctx)).status,
    ).toBe(403);
  });

  it("answers 403 for non-admins", async () => {
    getActor.mockResolvedValue(actorOf(await createLead()));
    const page = await createPage();
    expect((await POST(await postRequest(form(page.id, PNG_BYTES)), ctx)).status).toBe(403);
  });

  it("creates the upload for an admin", async () => {
    const { actor } = await adminActor();
    getActor.mockResolvedValue(actor);
    const page = await createPage();
    const response = await POST(await postRequest(form(page.id, PNG_BYTES)), ctx);
    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; url: string };
    expect(body.url).toBe(`${APP_CONFIG.uploads.urlPrefix}${body.id}`);
  });

  it("maps size and type errors to 413 and 415, a missing file to 400", async () => {
    const { actor } = await adminActor();
    getActor.mockResolvedValue(actor);
    const page = await createPage();
    const big = new Uint8Array(APP_CONFIG.uploads.maxBytes + 1);
    expect((await POST(await postRequest(form(page.id, big)), ctx)).status).toBe(413);
    expect((await POST(await postRequest(form(page.id, PDF_BYTES)), ctx)).status).toBe(415);
    const empty = new FormData();
    empty.set("pageId", page.id);
    expect((await POST(await postRequest(empty), ctx)).status).toBe(400);
  });

  it("rejects before reading the body when the declared length is missing or too large", async () => {
    const { actor } = await adminActor();
    getActor.mockResolvedValue(actor);
    const page = await createPage();
    const tooBig = APP_CONFIG.uploads.maxBytes * 100;
    expect(
      (await POST(await postRequest(form(page.id, PNG_BYTES), undefined, tooBig), ctx)).status,
    ).toBe(413);
    const noLength = new NextRequest("http://localhost/api/uploads", {
      method: "POST",
      body: form(page.id, PNG_BYTES),
      headers: { origin: new URL(env.APP_URL).origin },
    });
    noLength.headers.delete("content-length");
    expect((await POST(noLength, ctx)).status).toBe(413);
  });

  it("checks the permission before the body: a lead with an oversized declared length gets 403", async () => {
    getActor.mockResolvedValue(actorOf(await createLead()));
    const page = await createPage();
    const tooBig = APP_CONFIG.uploads.maxBytes * 100;
    expect(
      (await POST(await postRequest(form(page.id, PNG_BYTES), undefined, tooBig), ctx)).status,
    ).toBe(403);
  });
});
