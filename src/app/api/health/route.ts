import { checkDatabase } from "@/server/services/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { ok } = await checkDatabase();
  return Response.json(
    { ok },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
