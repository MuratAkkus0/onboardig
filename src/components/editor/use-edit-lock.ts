"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { APP_CONFIG } from "@/config/app";
import { acquireLockAction } from "@/app/(app)/admin/library/pages/[pageId]/edit/actions";

/**
 * acquiring: asking for the lock. editing: lock is mine. held: someone else edits (read-only).
 * lost: the lock was taken over or expired while editing. idle: released after the idle prompt
 * went unanswered. failed: the lock could not be requested at all.
 */
export type LockPhase = "acquiring" | "editing" | "held" | "lost" | "idle" | "failed";

export interface LockHolder {
  name: string | null;
  since: Date | null;
}

interface Options {
  pageId: string;
  /** Called when editing ends without a save (lock lost, idle): store the unsaved draft locally. */
  onDraftNeeded: () => void;
  /** Called once the lock is mine. */
  onAcquired: () => void;
}

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "input", "wheel"] as const;

export function asDate(value: unknown): Date | null {
  return typeof value === "string" || value instanceof Date ? new Date(value) : null;
}

/** K§4 lease lock for the editor: acquire, heartbeat, release on leave, idle prompt. */
export function useEditLock({ pageId, onDraftNeeded, onAcquired }: Options) {
  const [phase, setPhase] = useState<LockPhase>("acquiring");
  const [holder, setHolder] = useState<LockHolder | null>(null);
  const [idlePrompt, setIdlePrompt] = useState(false);
  const holding = useRef(false);
  const storeDraft = useEffectEvent(onDraftNeeded);
  const acquired = useEffectEvent(onAcquired);

  const releaseUrl = `/api/locks/${pageId}/release`;
  const heartbeatUrl = `/api/locks/${pageId}/heartbeat`;

  /** Releases the lock (fire and forget, survives navigation). */
  const release = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    void fetch(releaseUrl, { method: "POST", keepalive: true }).catch(() => undefined);
  }, [releaseUrl]);

  const markLost = useCallback((by: LockHolder | null) => {
    holding.current = false;
    setHolder(by);
    setPhase("lost");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await acquireLockAction({ pageId });
      if (cancelled) return;
      if (result.ok) {
        holding.current = true;
        setPhase("editing");
        acquired();
      } else if (result.error.code === "LOCK_HELD") {
        const details = result.error.details ?? {};
        setHolder({
          name: typeof details.holderName === "string" ? details.holderName : null,
          since: asDate(details.since),
        });
        setPhase("held");
      } else {
        setPhase("failed");
      }
    })();
    return () => {
      cancelled = true;
      release();
    };
  }, [pageId, release]);

  useEffect(() => {
    if (phase !== "editing") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(heartbeatUrl, { method: "POST" });
          if (response.status >= 500) return; // transient: try again on the next beat
          const body: unknown = response.ok ? await response.json() : { held: false };
          const state = body as { held?: boolean; holderName?: unknown; since?: unknown };
          if (state.held) return;
          storeDraft();
          markLost({
            name: typeof state.holderName === "string" ? state.holderName : null,
            since: asDate(state.since),
          });
        } catch {
          // offline: the lease keeps running, the next beat retries
        }
      })();
    }, APP_CONFIG.locks.heartbeatIntervalMs);
    return () => window.clearInterval(timer);
  }, [phase, heartbeatUrl, markLost]);

  useEffect(() => {
    if (phase !== "editing") return;
    const onPageHide = () => {
      if (holding.current) navigator.sendBeacon(releaseUrl);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [phase, releaseUrl]);

  useEffect(() => {
    if (phase !== "editing") return;
    if (idlePrompt) {
      // No answer to "Are you still there?": keep the draft locally and let go of the lock.
      const grace = window.setTimeout(() => {
        storeDraft();
        release();
        setIdlePrompt(false);
        setPhase("idle");
      }, APP_CONFIG.locks.idlePromptGraceMs);
      return () => window.clearTimeout(grace);
    }
    let idle = 0;
    const arm = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(() => setIdlePrompt(true), APP_CONFIG.locks.idleTimeoutMs);
    };
    arm();
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, arm, { passive: true });
    return () => {
      window.clearTimeout(idle);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, arm);
    };
  }, [phase, idlePrompt, release]);

  const confirmPresence = useCallback(() => setIdlePrompt(false), []);

  return { phase, holder, idlePrompt, confirmPresence, release, markLost };
}
