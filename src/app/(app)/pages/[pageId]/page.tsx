import type { Metadata } from "next";
import { cache } from "react";
import { ZodError } from "zod";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { BackButton } from "@/components/common/back-button";
import { PageContent } from "@/components/content/page-content";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { PlanStepActions } from "@/components/plan/plan-step-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROUTES } from "@/config/app";
import { requirePageActor } from "@/server/auth/guards";
import type { Role } from "@/server/auth/types";
import { isAppError } from "@/server/errors";
import { getPageForView } from "@/server/services/pages";

const loadPage = cache(async (pageId: string) => {
  const actor = await requirePageActor();
  try {
    return await getPageForView(actor, { id: pageId });
  } catch (e) {
    // A malformed id fails validation: to the visitor it is simply a page that does not exist.
    if ((isAppError(e) && e.code === "NOT_FOUND") || e instanceof ZodError) notFound();
    throw e;
  }
});

/** Where "Back" leads when the page was opened directly: the place pages are usually opened from. */
const BACK_FALLBACK: Record<Role, string> = {
  employee: ROUTES.plan,
  team_lead: ROUTES.library,
  admin: ROUTES.adminLibrary,
};

export async function generateMetadata({
  params,
}: PageProps<"/pages/[pageId]">): Promise<Metadata> {
  const { pageId } = await params;
  const page = await loadPage(pageId);
  return { title: page.title };
}

export default async function Page({ params }: PageProps<"/pages/[pageId]">) {
  const { pageId } = await params;
  const page = await loadPage(pageId);
  const actor = await requirePageActor();
  const t = await getTranslations("library.view");
  const common = await getTranslations("common");
  const format = await getFormatter();
  const date = format.dateTime(page.lastEditedAt, { dateStyle: "medium", timeStyle: "short" });
  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-2">
        <BackButton fallbackHref={BACK_FALLBACK[actor.role]} />
      </div>
      <PageHeader
        title={page.title}
        description={
          page.lastEditedByName
            ? t("lastEditedBy", { name: page.lastEditedByName, date })
            : t("lastEdited", { date })
        }
        actions={
          page.status === "published" ? null : <StatusBadge kind="pageStatus" value={page.status} />
        }
      />
      <div className="space-y-4">
        {page.status === "draft" ? (
          <Alert>
            <AlertDescription>{t("previewDraft")}</AlertDescription>
          </Alert>
        ) : null}
        {page.status === "archived" ? (
          <Alert>
            <AlertDescription>{t("previewArchived")}</AlertDescription>
          </Alert>
        ) : null}
        {page.isFallback ? (
          <Alert>
            <AlertDescription>{common("germanOnly")}</AlertDescription>
          </Alert>
        ) : null}
        <PageContent content={page.content} />
        <PlanStepActions pageId={pageId} />
      </div>
    </article>
  );
}
