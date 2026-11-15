import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";
import { listLibrary } from "@/server/services/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library.readonly");
  return { title: t("title") };
}

/** Read-only library for team leads (and admins): published pages only. */
export default async function Page() {
  const actor = await requirePageRole(["team_lead", "admin"]);
  const t = await getTranslations("library.readonly");
  const modules = await listLibrary(actor, { status: "published" });
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {modules.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle>
                  <h2>{module.title}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {module.pages.map((page) => (
                    <li key={page.id}>
                      <Link
                        href={ROUTES.page(page.id)}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {page.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
