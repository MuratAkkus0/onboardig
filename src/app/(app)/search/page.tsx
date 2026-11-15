import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import { APP_CONFIG, W3_SEARCH_CONFIG } from "@/config/app";
import { requirePageActor } from "@/server/auth/guards";
import { search } from "@/server/services/search";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("search");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requirePageActor();
  const t = await getTranslations("search");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const tooLong = q.length > W3_SEARCH_CONFIG.queryMaxLength;
  const searchable = !tooLong && [...q].length >= APP_CONFIG.search.minQueryLength;
  const result = searchable ? await search(actor, { q }) : null;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SearchForm defaultValue={tooLong ? "" : q} />
      {tooLong ? (
        <p role="alert" className="text-sm text-destructive">
          {t("tooManyChars", { max: W3_SEARCH_CONFIG.queryMaxLength })}
        </p>
      ) : result === null ? (
        <EmptyState
          title={t("promptTitle")}
          description={t("promptDescription", { min: APP_CONFIG.search.minQueryLength })}
        />
      ) : result.pages.length === 0 && result.events.length === 0 ? (
        <EmptyState
          title={t("noResultsTitle")}
          description={t("noResultsDescription", { query: q })}
        />
      ) : (
        <SearchResults result={result} />
      )}
    </>
  );
}
