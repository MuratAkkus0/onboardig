import { NextResponse } from "next/server";
import { withActor } from "@/server/http/route";
import { getUnreadSummary } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export const GET = withActor(async (_req, { actor }) => {
  const summary = await getUnreadSummary(actor);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
});
