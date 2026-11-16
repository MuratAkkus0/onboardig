import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditPageRoute } from "@/components/editor/edit-page-route";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("editor");
  return { title: t("title") };
}

/** Lead page editor: same editor and lock UI as the admin one; the service checks the department. */
export default async function Page({ params }: PageProps<"/library/pages/[pageId]/edit">) {
  const { pageId } = await params;
  return <EditPageRoute pageId={pageId} area="lead" />;
}
