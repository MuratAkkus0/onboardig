import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { TemplateScope } from "@/components/templates/template-scope";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES, TEMPLATE_STATUSES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";
import { listTemplates } from "@/server/services/templates";

type Filter = "all" | (typeof TEMPLATE_STATUSES)[number];
const FILTERS: Filter[] = ["all", ...TEMPLATE_STATUSES];

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requirePageRole(["admin"]);
  const { status } = await searchParams;
  const filter = FILTERS.find((entry) => entry === status) ?? "all";
  const [t, items] = await Promise.all([
    getTranslations("templates"),
    listTemplates(actor, filter === "all" ? {} : { status: filter }),
  ]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href={ROUTES.adminTemplateNew}>
              <Plus aria-hidden="true" />
              {t("add")}
            </Link>
          </Button>
        }
      />
      <nav aria-label={t("filter.label")} className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <Button key={entry} asChild size="sm" variant={entry === filter ? "default" : "outline"}>
            <Link
              href={
                entry === "all" ? ROUTES.adminTemplates : `${ROUTES.adminTemplates}?status=${entry}`
              }
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
                    href={ROUTES.adminTemplate(item.id)}
                    className="underline-offset-4 hover:underline"
                    aria-label={t("list.open", { name: item.name })}
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <TemplateScope scope={item} />
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
