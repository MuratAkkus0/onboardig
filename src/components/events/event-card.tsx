import { useFormatter, useTranslations } from "next-intl";
import { DateTime } from "@/components/common/date-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventDto } from "@/server/services/events";

/** One event for the employee-facing list. The id anchor lets notification links jump here. */
export function EventCard({ event }: { event: EventDto }) {
  const t = useTranslations();
  const format = useFormatter();
  const sameDay =
    format.dateTime(event.startsAt, { dateStyle: "short" }) ===
    format.dateTime(event.endsAt, { dateStyle: "short" });
  return (
    <Card id={`event-${event.id}`} className="scroll-mt-20 target:ring-2 target:ring-ring">
      <CardHeader>
        <CardTitle className="text-lg break-words">
          <h3>{event.title}</h3>
        </CardTitle>
        {event.isFallback ? (
          <div>
            <Badge variant="outline">{t("common.germanOnly")}</Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[6rem_1fr]">
          <dt className="text-muted-foreground">{t("events.when")}</dt>
          <dd>
            <DateTime value={event.startsAt} />
            {" – "}
            {sameDay ? (
              <time dateTime={event.endsAt.toISOString()}>
                {format.dateTime(event.endsAt, { timeStyle: "short" })}
              </time>
            ) : (
              <DateTime value={event.endsAt} />
            )}
          </dd>
          {event.location ? (
            <>
              <dt className="text-muted-foreground">{t("events.location")}</dt>
              <dd className="break-words">{event.location}</dd>
            </>
          ) : null}
        </dl>
        <p className="break-words whitespace-pre-line">{event.description}</p>
      </CardContent>
    </Card>
  );
}
