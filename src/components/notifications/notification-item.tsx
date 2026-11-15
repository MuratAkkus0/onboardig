"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DateTime } from "@/components/common/date-time";
import { Button } from "@/components/ui/button";
import { resolveNotificationParams } from "@/lib/domain/notification-params";
import { cn } from "@/lib/utils";
import type { Locale } from "@/server/auth/types";
import type { ClientNotification } from "./types";

interface NotificationItemProps {
  notification: ClientNotification;
  onMarkRead: (id: string) => void;
  /** Called after the link was followed (the bell closes its panel). */
  onNavigate?: () => void;
}

/** One notification row: text (link when there is a target), time, unread dot and mark-read button. */
export function NotificationItem({ notification, onMarkRead, onNavigate }: NotificationItemProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const key = notification.messageKey;
  const text = t.has(key as never)
    ? t(key as never, resolveNotificationParams(notification.params, locale) as never)
    : "";
  const unread = !notification.read;

  function handleNavigate() {
    if (unread) onMarkRead(notification.id);
    onNavigate?.();
  }

  const body = (
    <>
      <span className={cn("block text-sm break-words", unread && "font-medium")}>{text}</span>
      <span className="block text-xs text-muted-foreground">
        <DateTime value={notification.occurredAt} />
      </span>
    </>
  );

  return (
    <li className="flex items-start gap-2 px-3 py-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          unread ? "bg-primary" : "bg-transparent",
        )}
      />
      <div className="min-w-0 flex-1">
        {unread ? <span className="sr-only">{t("notifications.list.unread")}: </span> : null}
        {notification.link ? (
          <Link
            href={notification.link}
            onClick={handleNavigate}
            className="block rounded-sm hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {body}
          </Link>
        ) : (
          <div>{body}</div>
        )}
      </div>
      {unread ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("notifications.actions.markRead")}
          title={t("notifications.actions.markRead")}
          onClick={() => onMarkRead(notification.id)}
        >
          <Check aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}
