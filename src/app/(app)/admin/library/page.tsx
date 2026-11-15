import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AdminLibrary } from "@/components/content/admin-library";
import { ModuleDialog } from "@/components/content/module-dialog";
import { Button } from "@/components/ui/button";
import { PAGE_STATUSES, ROUTES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";
import { listLibrary } from "@/server/services/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library.admin");
  return { title: t("title") };
}

export default async function Page({ searchParams }: PageProps<"/admin/library">) {
  const actor = await requirePageRole(["admin"]);
  const t = await getTranslations("library");
  const enums = await getTranslations("enums.pageStatus");
  const parsed = z.enum(PAGE_STATUSES).safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : undefined;
  const modules = await listLibrary(actor, status ? { status } : {});

  return (
    <>
      <PageHeader
        title={t("admin.title")}
        description={t("admin.description")}
        actions={
          <ModuleDialog
            trigger={
              <Button>
                <Plus />
                {t("admin.addModule")}
              </Button>
            }
          />
        }
      />
      <nav aria-label={t("admin.filterLabel")} className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant={status ? "outline" : "secondary"} size="sm">
          <Link href={ROUTES.adminLibrary} aria-current={status ? undefined : "page"}>
            {t("admin.filterAll")}
          </Link>
        </Button>
        {PAGE_STATUSES.map((value) => (
          <Button
            key={value}
            asChild
            variant={status === value ? "secondary" : "outline"}
            size="sm"
          >
            <Link
              href={`${ROUTES.adminLibrary}?status=${value}`}
              aria-current={status === value ? "page" : undefined}
            >
              {enums(value)}
            </Link>
          </Button>
        ))}
      </nav>
      {modules.length === 0 ? (
        <EmptyState title={t("admin.emptyTitle")} description={t("admin.emptyDescription")} />
      ) : (
        <AdminLibrary modules={modules} filtered={status !== undefined} />
      )}
    </>
  );
}
