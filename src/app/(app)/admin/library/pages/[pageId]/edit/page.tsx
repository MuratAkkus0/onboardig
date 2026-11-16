import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditPageRoute } from "@/components/editor/edit-page-route";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("editor");
  return { title: t("title") };
}

export default async function Page({ params }: PageProps<"/admin/library/pages/[pageId]/edit">) {
  const { pageId } = await params;
  return <EditPageRoute pageId={pageId} area="admin" />;
}
