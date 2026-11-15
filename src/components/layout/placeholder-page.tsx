import { useTranslations } from "next-intl";
import type { Messages } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

type NavMessages = Messages["nav"];
/** Keys of `nav` that hold a plain label (not a nested object). */
export type PlaceholderTitleKey = {
  [K in keyof NavMessages]: NavMessages[K] extends string ? K : never;
}[keyof NavMessages];

/**
 * Stub rendered by every route until its owning unit replaces the page. The owner deletes the
 * `<PlaceholderPage>` usage, not this component.
 */
export function PlaceholderPage({ titleKey }: { titleKey: PlaceholderTitleKey }) {
  const t = useTranslations();
  return (
    <>
      <PageHeader title={t(`nav.${titleKey}`)} />
      <EmptyState description={t("common.placeholder.body")} />
    </>
  );
}
