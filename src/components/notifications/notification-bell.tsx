"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROUTES, W1_NOTIFY_EVENTS_CONFIG } from "@/config/app";
import { markAllReadAction, markReadAction } from "@/app/(app)/notifications/actions";
import { NotificationItem } from "./notification-item";
import { useNotificationPoll, type UnreadSummary } from "./use-notification-poll";

/** Top-bar bell: unread badge, dropdown with the latest notifications, mark read / all read. */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const { summary, setSummary, refresh } = useNotificationPoll();
  const [open, setOpen] = useState(false);
  const unreadCount = summary?.unreadCount ?? 0;
  const latest = summary?.latest ?? [];
  const { badgeMaxCount } = W1_NOTIFY_EVENTS_CONFIG.notifications;

  async function run(
    optimistic: (current: UnreadSummary) => UnreadSummary,
    call: () => Promise<{ ok: boolean }>,
  ) {
    setSummary((current) => (current ? optimistic(current) : current));
    const result = await call();
    if (!result.ok) toast.error(t("errors.actionFailed"));
    await refresh();
  }

  function markRead(id: string) {
    const target = latest.find((item) => item.id === id);
    void run(
      (current) => ({
        unreadCount:
          target && !target.read ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
        latest: current.latest.map((item) => (item.id === id ? { ...item, read: true } : item)),
      }),
      () => markReadAction(id),
    );
  }

  function markAllRead() {
    void run(
      (current) => ({
        unreadCount: 0,
        latest: current.latest.map((item) => ({ ...item, read: true })),
      }),
      () => markAllReadAction(),
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? t("bell.labelUnread", { count: unreadCount }) : t("bell.label")
          }
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-destructive-foreground"
            >
              {unreadCount > badgeMaxCount ? `${badgeMaxCount}+` : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-sm font-semibold">{t("bell.panelTitle")}</h2>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            {t("actions.markAllRead")}
          </Button>
        </div>
        {latest.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("bell.empty")}</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto" aria-label={t("list.label")}>
            {latest.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={markRead}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ul>
        )}
        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href={ROUTES.notifications} onClick={() => setOpen(false)}>
              {t("bell.viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
