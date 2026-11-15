import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeProgressList } from "@/components/dashboard/employee-progress-list";
import { requirePageRole } from "@/server/auth/guards";
import { getTeamOverview } from "@/server/services/dashboards";

export default async function TeamPage() {
  const actor = await requirePageRole(["team_lead", "admin"]);
  const [t, rows] = await Promise.all([getTranslations("dashboard.team"), getTeamOverview(actor)]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {t("count", { count: rows.length })}
          </p>
          <EmployeeProgressList rows={rows} />
        </>
      )}
    </>
  );
}
