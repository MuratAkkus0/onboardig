"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  loadNotificationsAction,
  markAllReadAction,
  markReadAction,
} from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./notification-item";
import type { ClientNotification } from "./types";
import { announceNotificationsChanged } from "./use-notification-poll";

interface NotificationListProps {
  initialItems: ClientNotification[];
  initialCursor: string | null;
}

/** Full notification list with keyset "load older", mark read and mark all read. */
export function NotificationList({ initialItems, initialCursor }: NotificationListProps) {
  const t = useTranslations("notifications");
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();
  const hasUnread = items.some((item) => !item.read);

  function markRead(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    startTransition(async () => {
      const result = await markReadAction(id);
      if (!result.ok) toast.error(t("errors.actionFailed"));
      announceNotificationsChanged();
    });
  }

  function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    startTransition(async () => {
      const result = await markAllReadAction();
      if (!result.ok) toast.error(t("errors.actionFailed"));
      announceNotificationsChanged();
    });
  }

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const result = await loadNotificationsAction(cursor);
      if (!result.ok) {
        toast.error(t("errors.actionFailed"));
        return;
      }
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.data.items.filter((item) => !known.has(item.id))];
      });
      setCursor(result.data.nextCursor);
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasUnread || pending}
          onClick={markAllRead}
        >
          {t("actions.markAllRead")}
        </Button>
      </div>
      <ul className="divide-y rounded-lg border" aria-label={t("list.label")}>
        {items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={markRead}
          />
        ))}
      </ul>
      {cursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={pending} onClick={loadMore}>
            {pending ? t("list.loadingMore") : t("list.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
