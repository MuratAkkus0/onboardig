import Link from "next/link";
import { useTranslations } from "next-intl";
import { DateTime } from "@/components/common/date-time";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusBadge } from "@/components/common/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import type { OverviewRow } from "@/server/services/dashboards";

function Team({ row, empty }: { row: OverviewRow; empty: string }) {
  if (!row.teamName) return <>{empty}</>;
  return (
    <>
      <span>{row.teamName}</span>
      {row.departmentName ? (
        <span className="block text-sm text-muted-foreground">{row.departmentName}</span>
      ) : null}
    </>
  );
}

/** Same columns for the team lead panel and the admin overview: table from `md`, cards below. */
export function EmployeeProgressList({ rows }: { rows: OverviewRow[] }) {
  const t = useTranslations("dashboard.list");
  const empty = t("noValue");
  const start = (row: OverviewRow) =>
    row.startDate ? <DateTime value={row.startDate} variant="date" /> : empty;
  const last = (row: OverviewRow) =>
    row.lastActivityAt ? <DateTime value={row.lastActivityAt} variant="date" /> : empty;

  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label={t("label")}>
        {rows.map((row) => (
          <li key={row.id} className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={ROUTES.teamMember(row.id)}
                className="font-medium break-words underline-offset-4 hover:underline"
              >
                {row.name}
              </Link>
              <StatusBadge kind="onboardingStatus" value={row.status} />
            </div>
            <ProgressBar value={row.percent} />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("columns.team")}</dt>
              <dd>
                <Team row={row} empty={empty} />
              </dd>
              <dt className="text-muted-foreground">{t("columns.startDate")}</dt>
              <dd>{start(row)}</dd>
              <dt className="text-muted-foreground">{t("columns.lastActivity")}</dt>
              <dd>{last(row)}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.team")}</TableHead>
              <TableHead className="w-56">{t("columns.progress")}</TableHead>
              <TableHead>{t("columns.startDate")}</TableHead>
              <TableHead>{t("columns.lastActivity")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-normal">
                  <Link
                    href={ROUTES.teamMember(row.id)}
                    className="font-medium break-words underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Team row={row} empty={empty} />
                </TableCell>
                <TableCell>
                  <ProgressBar value={row.percent} />
                </TableCell>
                <TableCell>{start(row)}</TableCell>
                <TableCell>{last(row)}</TableCell>
                <TableCell>
                  <StatusBadge kind="onboardingStatus" value={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
