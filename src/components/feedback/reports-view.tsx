import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DateTime } from "@/components/common/date-time";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, ROUTES, V_FB_CONFIG } from "@/config/app";
import type { Actor } from "@/server/auth/types";
import { listReports, type ReportDto } from "@/server/services/feedback";
import { ReportActions } from "./report-actions";
import { ReportFilters } from "./report-filters";

type SearchParams = Record<string, string | string[] | undefined>;

function pick<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return allowed.find((candidate) => candidate === value) ?? null;
}

function reportTarget(report: ReportDto): string | null {
  return report.pageId ? ROUTES.page(report.pageId) : report.path;
}

const STATUS_VARIANT = { open: "default", in_progress: "secondary", done: "outline" } as const;

/** Shared list of reports for the admin (all) and the team lead (own department), with filters. */
export async function ReportsView({
  actor,
  basePath,
  searchParams,
}: {
  actor: Actor;
  basePath: string;
  searchParams: SearchParams;
}) {
  const [t, tEnums] = await Promise.all([getTranslations("feedback"), getTranslations("enums")]);
  const status = pick(searchParams[V_FB_CONFIG.filterParams.status], FEEDBACK_STATUSES);
  const type = pick(searchParams[V_FB_CONFIG.filterParams.type], FEEDBACK_TYPES);
  const reports = await listReports(actor, {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  });
  const isAdmin = actor.role === "admin";
  const filtered = status !== null || type !== null;

  return (
    <>
      <PageHeader
        title={t("list.title")}
        description={isAdmin ? t("list.descriptionAdmin") : t("list.descriptionLead")}
      />
      <ReportFilters basePath={basePath} status={status} type={type} />
      {reports.length === 0 ? (
        <EmptyState
          title={filtered ? t("list.emptyFilteredTitle") : t("list.emptyTitle")}
          description={filtered ? t("list.emptyFilteredDescription") : t("list.emptyDescription")}
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {t("list.count", { count: reports.length })}
          </p>
          <ul className="space-y-4" aria-label={t("list.label")}>
            {reports.map((report) => {
              const target = reportTarget(report);
              return (
                <li key={report.id}>
                  <Card>
                    <CardHeader className="gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{tEnums(`feedbackType.${report.type}`)}</Badge>
                        <Badge variant={STATUS_VARIANT[report.status]}>
                          {tEnums(`feedbackStatus.${report.status}`)}
                        </Badge>
                      </div>
                      <h2 className="text-base leading-snug font-semibold break-words">
                        {report.subject}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t("list.reportedBy", {
                          name: report.reporter?.name ?? t("list.deletedUser"),
                        })}
                        {" · "}
                        <DateTime value={report.createdAt} />
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm break-words whitespace-pre-wrap">{report.message}</p>
                      {target ? (
                        <p className="text-sm break-all">
                          <span className="text-muted-foreground">{t("list.location")}: </span>
                          <Link href={target} className="underline underline-offset-2">
                            {report.pageId ? t("list.openPage") : report.path}
                          </Link>
                        </p>
                      ) : null}
                      {report.response ? (
                        <div className="rounded-md border bg-muted/40 p-3 text-sm">
                          <p className="font-medium">
                            {report.handledByName
                              ? t("list.responseBy", { name: report.handledByName })
                              : t("list.response")}
                          </p>
                          <p className="break-words whitespace-pre-wrap">{report.response}</p>
                        </div>
                      ) : null}
                      <ReportActions
                        id={report.id}
                        subject={report.subject}
                        status={report.status}
                        response={report.response}
                        canDelete={isAdmin}
                      />
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
