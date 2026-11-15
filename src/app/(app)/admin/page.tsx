import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeProgressList } from "@/components/dashboard/employee-progress-list";
import { OverviewFilters } from "@/components/dashboard/overview-filters";
import { OverviewSummary } from "@/components/dashboard/overview-summary";
import { summarizeOverview } from "@/components/dashboard/summary";
import { ONBOARDING_STATUSES, W1_ORG_CONFIG } from "@/config/app";
import { idSchema } from "@/lib/validation/common";
import { requirePageRole } from "@/server/auth/guards";
import { getAdminOverview } from "@/server/services/dashboards";
import { listOrgOptions } from "@/server/services/org";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first && first !== W1_ORG_CONFIG.allValue ? first : "";
}

function pickId(value: string): string | undefined {
  return idSchema.safeParse(value).success ? value : undefined;
}

/** Invalid URL values are treated as "no filter". */
function readFilters(params: SearchParams) {
  const status = single(params, "status");
  return {
    departmentId: pickId(single(params, "departmentId")),
    teamId: pickId(single(params, "teamId")),
    status: ONBOARDING_STATUSES.find((candidate) => candidate === status),
  };
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requirePageRole(["admin"]);
  const filters = readFilters(await searchParams);
  const [t, orgOptions, rows] = await Promise.all([
    getTranslations("dashboard.admin"),
    listOrgOptions(actor),
    getAdminOverview(actor, filters),
  ]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <OverviewFilters
        values={{
          departmentId: filters.departmentId ?? "",
          teamId: filters.teamId ?? "",
          status: filters.status ?? "",
        }}
        orgOptions={orgOptions}
      />
      <OverviewSummary summary={summarizeOverview(rows)} />
      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredDescription") : t("empty.description")}
        />
      ) : (
        <EmployeeProgressList rows={rows} />
      )}
    </>
  );
}
