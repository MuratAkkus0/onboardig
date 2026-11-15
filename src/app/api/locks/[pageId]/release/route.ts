import { withActor } from "@/server/http/route";
import { releaseLock } from "@/server/services/locks";

/** Also called with `navigator.sendBeacon` when the tab closes. */
export const POST = withActor<{ pageId: string }>(async (_req, { actor, params }) => {
  await releaseLock(actor, { pageId: params.pageId });
  return new Response(null, { status: 204 });
});
