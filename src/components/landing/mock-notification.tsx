import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { LANDING_CONFIG } from "@/config/app";
import { cssVars, motionStyle } from "./motion";

/** In-app notification about a new event; rises in after the step is done, floats twice, rests. */
export function MockNotification() {
  const t = useTranslations();
  const format = useFormatter();
  const { event } = LANDING_CONFIG.demo;
  const { notificationDelayMs, notificationRiseMs, floatMs, floatIterations } =
    LANDING_CONFIG.motion;
  return (
    <div
      className="flex landing-anim-notify gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-float"
      style={{
        ...motionStyle(notificationDelayMs, notificationRiseMs),
        ...cssVars({
          "--landing-float-delay": `${notificationDelayMs + notificationRiseMs}ms`,
          "--landing-float-duration": `${floatMs}ms`,
          "--landing-float-iterations": floatIterations,
        }),
      }}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-soft-foreground">
        <Bell className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {t("enums.notificationType.event_announced")}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {t("landing.mock.eventLine", {
            title: t("landing.mock.event.title"),
            date: format.dateTime(new Date(event.startsAt), {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </span>
      </span>
    </div>
  );
}
