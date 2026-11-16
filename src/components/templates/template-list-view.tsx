import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TEMPLATE_STATUSES } from "@/config/app";
import { areaRoutes, type Area } from "@/lib/area-routes";
import type { TemplateListItem } from "@/server/services/templates";
import { TemplateManagedBadge } from "./template-managed-badge";
import { TemplateScope } from "./template-scope";

export type TemplateFilter = "all" | (typeof TEMPLATE_STATUSES)[number];
export const TEMPLATE_FILTERS: TemplateFilter[] = ["all", ...TEMPLATE_STATUSES];

/** Template list with status filter, shared by the admin and the team lead screens. */
export async function TemplateListView({
  area,
  items,
  filter,
}: {
  area: Area;
  items: TemplateListItem[];
  filter: TemplateFilter;
}) {
  const t = await getTranslations("templates");
  const routes = areaRoutes(area);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={area === "lead" ? t("lead.description") : t("description")}
        actions={
          <Button asChild>
            <Link href={routes.templateNew}>
              <Plus aria-hidden="true" />
              {t("add")}
            </Link>
          </Button>
        }
      />
      <nav aria-label={t("filter.label")} className="mb-4 flex flex-wrap gap-2">
        {TEMPLATE_FILTERS.map((entry) => (
          <Button key={entry} asChild size="sm" variant={entry === filter ? "default" : "outline"}>
            <Link
              href={entry === "all" ? routes.templates : `${routes.templates}?status=${entry}`}
              aria-current={entry === filter ? "page" : undefined}
            >
              {t(`filter.${entry}`)}
            </Link>
          </Button>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.name")}</TableHead>
              <TableHead>{t("list.scope")}</TableHead>
              <TableHead>{t("list.management")}</TableHead>
              <TableHead className="text-right">{t("list.steps")}</TableHead>
              <TableHead className="text-right">{t("list.assigned")}</TableHead>
              <TableHead>{t("list.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-64 font-medium break-words whitespace-normal">
                  <Link
                    href={routes.template(item.id)}
                    className="underline-offset-4 hover:underline"
                    aria-label={t("list.open", { name: item.name })}
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <TemplateScope scope={item} />
                </TableCell>
                <TableCell>
                  <TemplateManagedBadge leadManaged={item.leadManaged} />
                </TableCell>
                <TableCell className="text-right">{item.stepCount}</TableCell>
                <TableCell className="text-right">{item.assignmentCount}</TableCell>
                <TableCell>
                  <StatusBadge kind="templateStatus" value={item.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
