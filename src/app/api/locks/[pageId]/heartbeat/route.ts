import { NextResponse } from "next/server";
import { withActor } from "@/server/http/route";
import { heartbeat } from "@/server/services/locks";

export const POST = withActor<{ pageId: string }>(async (_req, { actor, params }) => {
  const result = await heartbeat(actor, { pageId: params.pageId });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
});
