import { ReportsView } from "@/components/feedback/reports-view";
import { ROUTES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole(["admin"]);
  return (
    <ReportsView actor={actor} basePath={ROUTES.adminReports} searchParams={await searchParams} />
  );
}
