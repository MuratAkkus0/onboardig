import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EventCard } from "@/components/events/event-card";
import { requirePageActor } from "@/server/auth/guards";
import { listEvents } from "@/server/services/events";

export default async function EventsPage() {
  const actor = await requirePageActor();
  const t = await getTranslations("events");
  const { upcoming, past } = await listEvents(actor);
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="max-w-3xl space-y-10">
        <section aria-labelledby="events-upcoming" className="space-y-4">
          <h2 id="events-upcoming" className="text-lg font-semibold">
            {t("upcoming")}
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              title={t("emptyUpcomingTitle")}
              description={t("emptyUpcomingDescription")}
            />
          ) : (
            <div className="space-y-4">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
        <section aria-labelledby="events-past" className="space-y-4">
          <h2 id="events-past" className="text-lg font-semibold">
            {t("past")}
          </h2>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyPast")}</p>
          ) : (
            <div className="space-y-4">
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
