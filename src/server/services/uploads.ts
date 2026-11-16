import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { APP_CONFIG, W1_CONTENT_CONFIG } from "@/config/app";
import { uploadUrl } from "@/lib/tiptap/uploads";
import { idInputSchema, uploadImageSchema } from "@/lib/validation/content";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { uploads } from "@/server/db/schema";
import { AppError, pgErrorCode, PG_ERROR } from "@/server/errors";
import { logger } from "@/server/logger";
import { getStorage } from "@/server/storage";
import { assertCanEditPageInTx } from "./content-access";
import { canViewPageInTx } from "./visibility";

type AllowedMime = (typeof APP_CONFIG.uploads.allowedMimeTypes)[number];

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function isAllowedMime(mime: string): mime is AllowedMime {
  return (APP_CONFIG.uploads.allowedMimeTypes as readonly string[]).includes(mime);
}

/** Display name only (never a path): strips directories and control characters, caps the length. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, W1_CONTENT_CONFIG.maxUploadNameLength);
  return clean === "" ? "image" : clean;
}

function storageKeyFor(mime: AllowedMime, now: Date): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${randomUUID()}.${W1_CONTENT_CONFIG.imageExtensions[mime]}`;
}

export async function uploadImage(
  actor: Actor,
  input: { pageId: string; fileName: string; bytes: Uint8Array },
): Promise<{ id: string; url: string }> {
  assertPermission(actor, "content.edit");
  const data = uploadImageSchema.parse(input);
  if (data.bytes.byteLength > APP_CONFIG.uploads.maxBytes) throw new AppError("FILE_TOO_LARGE");
  if (data.bytes.byteLength === 0) throw new AppError("FILE_TYPE_NOT_ALLOWED");
  // The type comes from the magic bytes, never from the client-sent name or Content-Type.
  const detected = await fileTypeFromBuffer(data.bytes);
  if (!detected || !isAllowedMime(detected.mime)) throw new AppError("FILE_TYPE_NOT_ALLOWED");

  // Fail before storing a file; the check is repeated in the insert transaction below.
  await db.transaction((tx) => assertCanEditPageInTx(tx, actor, data.pageId));

  const storage = getStorage();
  const storageKey = storageKeyFor(detected.mime, new Date());
  await storage.put(storageKey, data.bytes);
  try {
    const row = await db.transaction(async (tx) => {
      await assertCanEditPageInTx(tx, actor, data.pageId);
      const [inserted] = await tx
        .insert(uploads)
        .values({
          pageId: data.pageId,
          storageKey,
          originalName: sanitizeFileName(data.fileName),
          mimeType: detected.mime,
          sizeBytes: data.bytes.byteLength,
          uploadedBy: actor.id,
        })
        .returning({ id: uploads.id });
      return inserted;
    });
    if (!row) throw new AppError("INTERNAL");
    return { id: row.id, url: uploadUrl(row.id) };
  } catch (e) {
    await storage
      .delete(storageKey)
      .catch((error: unknown) =>
        logger.error(
          { err: error instanceof Error ? error.message : "unknown" },
          "removing an orphaned upload file failed",
        ),
      );
    // The page was deleted while the file was being stored.
    if (pgErrorCode(e) === PG_ERROR.foreignKeyViolation) throw new AppError("NOT_FOUND");
    throw e;
  }
}

export interface ServedImage {
  stream: ReadableStream<Uint8Array>;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Admins may read every upload. Everybody else needs to be allowed to see the page the image
 * belongs to (`visibility.ts`; archived pages count for the leads of their department); uploads without a page and hidden pages answer NOT_FOUND.
 */
export async function getImageForServing(
  actor: Actor,
  input: { id: string },
): Promise<ServedImage> {
  const { id } = idInputSchema.parse(input);
  const upload = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(uploads).where(eq(uploads.id, id));
    if (!row) return null;
    if (actor.role === "admin") return row;
    if (row.pageId === null) return null;
    return (await canViewPageInTx(tx, actor, row.pageId, { includeArchived: true })) ? row : null;
  });
  if (!upload) throw new AppError("NOT_FOUND");
  const stored = await getStorage().get(upload.storageKey);
  if (!stored) throw new AppError("NOT_FOUND");
  return { stream: stored.stream, mimeType: upload.mimeType, sizeBytes: stored.sizeBytes };
}
