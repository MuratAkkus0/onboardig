import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app";
import { AppError } from "@/server/errors";
import { withActor } from "@/server/http/route";
import { uploadImage } from "@/server/services/uploads";

export const POST = withActor(async (req, { actor }) => {
  const form = await req.formData();
  const file = form.get("file");
  const pageId = form.get("pageId");
  if (!(file instanceof File) || typeof pageId !== "string") {
    throw new AppError("VALIDATION", {
      fieldErrors: { [file instanceof File ? "pageId" : "file"]: ["validation.required"] },
    });
  }
  // Reject oversized files before buffering them; the service checks again.
  if (file.size > APP_CONFIG.uploads.maxBytes) throw new AppError("FILE_TOO_LARGE");
  const result = await uploadImage(actor, {
    pageId,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return NextResponse.json(result, { status: 201 });
});
