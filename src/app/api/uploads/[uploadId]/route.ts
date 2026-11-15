import { W1_CONTENT_CONFIG } from "@/config/app";
import { withActor } from "@/server/http/route";
import { getImageForServing } from "@/server/services/uploads";

export const GET = withActor<{ uploadId: string }>(async (_req, { actor, params }) => {
  const image = await getImageForServing(actor, { id: params.uploadId });
  return new Response(image.stream, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.sizeBytes),
      "Cache-Control": W1_CONTENT_CONFIG.imageCacheControl,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});
