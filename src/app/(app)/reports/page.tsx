import { ReportsView } from "@/components/feedback/reports-view";
import { ROUTES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole(["team_lead", "admin"]);
  return <ReportsView actor={actor} basePath={ROUTES.reports} searchParams={await searchParams} />;
}
