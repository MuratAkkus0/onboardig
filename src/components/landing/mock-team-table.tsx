import { CheckCircle2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/common/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APP_CONFIG, LANDING_CONFIG } from "@/config/app";
import { MockWindow } from "./mock-window";

/**
 * Team-lead dashboard table with the fictional sample team. Shown from lg behind the plan card;
 * the body padding equals the covered width (2 of the window's 7 grid columns plus a gap).
 */
export function MockTeamTable() {
  const t = useTranslations();
  const format = useFormatter();
  const { team } = LANDING_CONFIG.demo;
  return (
    <MockWindow
      path={t("landing.mock.windowPathTeam", { appSlug: APP_CONFIG.appName.toLowerCase() })}
      pathAlign="end"
      bodyClassName="pb-2 sm:pb-3 lg:pl-[calc(200%/7+1rem)]"
    >
      <div className="flex items-baseline justify-between gap-3 px-2">
        <p className="font-semibold">{t("dashboard.team.title")}</p>
        <p className="text-xs text-muted-foreground">
          {t("dashboard.team.count", { count: team.length })}
        </p>
      </div>
      <Table className="mt-3 text-[0.8125rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("dashboard.list.columns.name")}</TableHead>
            <TableHead>{t("dashboard.list.columns.progress")}</TableHead>
            <TableHead>{t("dashboard.list.columns.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.map((person) => (
            <TableRow key={person.key} className="hover:bg-transparent">
              <TableCell className="font-medium">
                {t(`landing.mock.people.${person.key}`)}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ring-track">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${person.percent}%` }}
                    />
                  </span>
                  <span className="font-landing-mono text-xs tabular-nums">
                    {format.number(person.percent / 100, { style: "percent" })}
                  </span>
                  {person.status === "completed" ? (
                    <CheckCircle2 className="size-3.5 text-success" />
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge kind="onboardingStatus" value={person.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MockWindow>
  );
}
