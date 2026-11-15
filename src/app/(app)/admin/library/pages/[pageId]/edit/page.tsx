import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";
import { PageEditor } from "@/components/editor/page-editor";
import type { EditablePage } from "@/components/editor/types";
import { requirePageRole } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getPageForEdit } from "@/server/services/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("editor");
  return { title: t("title") };
}

export default async function Page({ params }: PageProps<"/admin/library/pages/[pageId]/edit">) {
  const { pageId } = await params;
  const actor = await requirePageRole(["admin"]);
  let editable: EditablePage;
  try {
    const page = await getPageForEdit(actor, { id: pageId });
    editable = {
      id: page.id,
      moduleTitle: page.moduleTitle,
      status: page.status,
      titleDe: page.titleDe,
      titleEn: page.titleEn,
      contentDe: page.contentDe as EditablePage["contentDe"],
      contentEn: page.contentEn as EditablePage["contentEn"],
      lastEditedAt: page.lastEditedAt.toISOString(),
      lastEditedByName: page.lastEditedByName,
    };
  } catch (e) {
    if ((isAppError(e) && e.code === "NOT_FOUND") || e instanceof ZodError) notFound();
    throw e;
  }
  return <PageEditor page={editable} />;
}
