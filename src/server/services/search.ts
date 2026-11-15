import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { APP_CONFIG, W3_SEARCH_CONFIG } from "@/config/app";
import { parseHeadline, type SnippetFragment } from "@/components/search/highlight";
import { searchInputSchema } from "@/lib/validation/search";
import { assertPermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { events, modules, pages } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { visiblePagesCondition } from "./visibility";

export interface PageHit {
  pageId: string;
  title: string;
  snippet: SnippetFragment[];
  moduleTitle: string;
}

export interface EventHit {
  eventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

export interface SearchResult {
  pages: PageHit[];
  events: EventHit[];
}

const { headline } = W3_SEARCH_CONFIG;
const headlineOptions = [
  `StartSel=${headline.startSel}`,
  `StopSel=${headline.stopSel}`,
  `FragmentDelimiter=${headline.fragmentDelimiter}`,
  `MinWords=${headline.minWords}`,
  `MaxWords=${headline.maxWords}`,
  `MaxFragments=${headline.maxFragments}`,
].join(",");

/** Escapes LIKE wildcards so the query is matched literally (backslash is the escape char). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Full-text search over the pages the actor may see (visiblePagesCondition) plus events.
 * Queries shorter than the configured minimum return nothing.
 */
export async function search(actor: Actor, input: { q: string }): Promise<SearchResult> {
  assertPermission(actor, "events.view");
  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION", { issues: parsed.error.issues });
  const { q } = parsed.data;
  if ([...q].length < APP_CONFIG.search.minQueryLength) return { pages: [], events: [] };

  const [pageHits, eventHits] = await Promise.all([searchPages(actor, q), searchEvents(actor, q)]);
  return { pages: pageHits, events: eventHits };
}

async function searchPages(actor: Actor, q: string): Promise<PageHit[]> {
  const english = actor.locale === "en";
  const qDe = sql`websearch_to_tsquery('german'::regconfig, ${q}::text)`;
  const qEn = sql`websearch_to_tsquery('english'::regconfig, ${q}::text)`;
  const useEn = english ? sql`${pages.titleEn} is not null` : sql`false`;
  const matches = english
    ? sql`((${pages.titleEn} is not null and ${pages.searchEn} @@ ${qEn}) or (${pages.titleEn} is null and ${pages.searchDe} @@ ${qDe}))`
    : sql`${pages.searchDe} @@ ${qDe}`;
  const rank = english
    ? sql<number>`case when ${useEn} then ts_rank(${pages.searchEn}, ${qEn}) else ts_rank(${pages.searchDe}, ${qDe}) end`
    : sql<number>`ts_rank(${pages.searchDe}, ${qDe})`;
  const strip = (column: unknown) =>
    sql`regexp_replace(coalesce(${column}, ''), '[\\x01-\\x03]', '', 'g')`;
  const headlineDe = sql`ts_headline('german'::regconfig, ${strip(pages.textDe)}, ${qDe}, ${headlineOptions}::text)`;
  const headlineEn = sql`ts_headline('english'::regconfig, ${strip(pages.textEn)}, ${qEn}, ${headlineOptions}::text)`;

  const rows = await db
    .select({
      pageId: pages.id,
      title: sql<string>`case when ${useEn} then ${pages.titleEn} else ${pages.titleDe} end`,
      headline: sql<string>`case when ${useEn} then ${headlineEn} else ${headlineDe} end`,
      moduleTitle: english
        ? sql<string>`coalesce(${modules.titleEn}, ${modules.titleDe})`
        : sql<string>`${modules.titleDe}`,
    })
    .from(pages)
    .innerJoin(modules, eq(modules.id, pages.moduleId))
    .where(and(visiblePagesCondition(actor), matches))
    .orderBy(desc(rank), desc(pages.contentUpdatedAt), pages.id)
    .limit(APP_CONFIG.search.maxResults);

  return rows.map((row) => ({
    pageId: row.pageId,
    title: row.title,
    snippet: parseHeadline(row.headline),
    moduleTitle: row.moduleTitle,
  }));
}

async function searchEvents(actor: Actor, q: string): Promise<EventHit[]> {
  const english = actor.locale === "en";
  const pattern = `%${escapeLike(q)}%`;
  const useEn = english ? sql`${events.titleEn} is not null` : sql`false`;
  const matches = english
    ? sql`(case when ${useEn} then ${events.titleEn} ilike ${pattern} escape '\\' or ${events.descriptionEn} ilike ${pattern} escape '\\' else ${events.titleDe} ilike ${pattern} escape '\\' or ${events.descriptionDe} ilike ${pattern} escape '\\' end)`
    : sql`(${events.titleDe} ilike ${pattern} escape '\\' or ${events.descriptionDe} ilike ${pattern} escape '\\')`;

  const rows = await db
    .select({
      eventId: events.id,
      title: sql<string>`case when ${useEn} then ${events.titleEn} else ${events.titleDe} end`,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
    })
    .from(events)
    .where(matches)
    .orderBy(desc(events.startsAt), desc(events.id))
    .limit(APP_CONFIG.search.maxResults);
  return rows;
}
