import Link from "next/link";
import { useTranslations } from "next-intl";
import { DateTime } from "@/components/common/date-time";
import { ROUTES } from "@/config/app";
import type { SearchResult } from "@/server/services/search";
import { Snippet } from "./snippet";

export function SearchResults({ result }: { result: SearchResult }) {
  const t = useTranslations("search");
  return (
    <div className="max-w-3xl space-y-10">
      <section aria-labelledby="search-pages" className="space-y-4">
        <h2 id="search-pages" className="text-lg font-semibold">
          {t("pages")}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({t("resultCount", { count: result.pages.length })})
          </span>
        </h2>
        {result.pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPageResults")}</p>
        ) : (
          <ul className="space-y-4">
            {result.pages.map((hit) => (
              <li key={hit.pageId} className="space-y-1 rounded-lg border p-4">
                <Link
                  href={ROUTES.page(hit.pageId)}
                  className="font-medium break-words text-primary underline-offset-4 hover:underline"
                >
                  {hit.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t("inModule", { module: hit.moduleTitle })}
                </p>
                <Snippet fragments={hit.snippet} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="search-events" className="space-y-4">
        <h2 id="search-events" className="text-lg font-semibold">
          {t("events")}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({t("resultCount", { count: result.events.length })})
          </span>
        </h2>
        {result.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noEventResults")}</p>
        ) : (
          <ul className="space-y-4">
            {result.events.map((hit) => (
              <li key={hit.eventId} className="space-y-1 rounded-lg border p-4">
                <Link
                  href={`${ROUTES.events}#event-${hit.eventId}`}
                  className="font-medium break-words text-primary underline-offset-4 hover:underline"
                >
                  {hit.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  <DateTime value={hit.startsAt} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
