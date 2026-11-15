import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app";
import { assertPermission } from "@/server/auth/permissions";
import { AppError } from "@/server/errors";
import { withActor } from "@/server/http/route";
import { uploadImage } from "@/server/services/uploads";

/** Room for the multipart boundaries and the pageId field around the file itself. */
const MULTIPART_OVERHEAD_BYTES = 16 * 1024;

export const POST = withActor(async (req, { actor }) => {
  // Authorize and bound the body before reading it: formData() buffers everything in memory.
  assertPermission(actor, "content.manage");
  const declaredLength = Number(req.headers.get("content-length"));
  if (
    !Number.isFinite(declaredLength) ||
    declaredLength <= 0 ||
    declaredLength > APP_CONFIG.uploads.maxBytes + MULTIPART_OVERHEAD_BYTES
  ) {
    throw new AppError("FILE_TOO_LARGE");
  }
  const form = await req.formData();
  const file = form.get("file");
  const pageId = form.get("pageId");
  if (!(file instanceof File) || typeof pageId !== "string") {
    throw new AppError("VALIDATION", {
      fieldErrors: { [file instanceof File ? "pageId" : "file"]: ["validation.required"] },
    });
  }
  // The exact file size is checked here and again in the service.
  if (file.size > APP_CONFIG.uploads.maxBytes) throw new AppError("FILE_TOO_LARGE");
  const result = await uploadImage(actor, {
    pageId,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return NextResponse.json(result, { status: 201 });
});
