"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_CONFIG, W1_NOTIFY_EVENTS_CONFIG } from "@/config/app";
import type { ClientNotification } from "./types";

export interface UnreadSummary {
  unreadCount: number;
  latest: ClientNotification[];
}

const { pollPath, changedEvent } = W1_NOTIFY_EVENTS_CONFIG.notifications;

/** Tells every mounted bell to refresh now (used after marking read on the notifications page). */
export function announceNotificationsChanged(): void {
  window.dispatchEvent(new Event(changedEvent));
}

/**
 * Polls the unread summary every `pollIntervalMs`, refreshes when the tab becomes visible again,
 * and pauses while the tab is hidden.
 */
export function useNotificationPoll() {
  const [summary, setSummary] = useState<UnreadSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(pollPath, { cache: "no-store" });
      if (response.ok) setSummary((await response.json()) as UnreadSummary);
    } catch {
      // Offline or server restarting: keep the last known state, the next tick retries.
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => void refresh(), APP_CONFIG.notifications.pollIntervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    };
    const onChanged = () => void refresh();

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(changedEvent, onChanged);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(changedEvent, onChanged);
    };
  }, [refresh]);

  return { summary, setSummary, refresh };
}
