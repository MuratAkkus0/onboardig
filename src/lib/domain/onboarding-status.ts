import type { ONBOARDING_STATUSES } from "@/config/app";
import { AppError } from "@/server/errors";

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export type OnboardingEvent =
  | { type: "progress"; completed: number; total: number }
  | { type: "deactivate" }
  | { type: "reactivate" };

export interface OnboardingTransition {
  status: OnboardingStatus;
  changed: boolean;
  becameCompleted: boolean;
}

/**
 * Pure onboarding status machine (blueprint section 3.2).
 * @throws AppError("INVALID_TRANSITION") for deactivate on archived / reactivate on non-archived.
 */
export function applyOnboardingEvent(
  current: OnboardingStatus,
  event: OnboardingEvent,
): OnboardingTransition {
  switch (event.type) {
    case "deactivate": {
      if (current === "archived") throw new AppError("INVALID_TRANSITION", { from: current });
      return { status: "archived", changed: true, becameCompleted: false };
    }
    case "reactivate": {
      if (current !== "archived") throw new AppError("INVALID_TRANSITION", { from: current });
      return { status: "active", changed: true, becameCompleted: false };
    }
    case "progress": {
      if (current === "archived")
        return { status: current, changed: false, becameCompleted: false };
      const done = event.total > 0 && event.completed === event.total;
      const status: OnboardingStatus = done ? "completed" : "active";
      return {
        status,
        changed: status !== current,
        becameCompleted: done && current === "active",
      };
    }
  }
}

export function canDeletePermanently(status: OnboardingStatus): boolean {
  return status === "archived";
}
