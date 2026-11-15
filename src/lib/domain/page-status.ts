import { PAGE_STATUSES } from "@/config/app";
import { AppError } from "@/server/errors";

export type PageStatus = (typeof PAGE_STATUSES)[number];
export type PageAction = "publish" | "unpublish" | "archive" | "restore";

export const PAGE_TRANSITIONS: Record<PageStatus, Partial<Record<PageAction, PageStatus>>> = {
  draft: { publish: "published", archive: "archived" },
  published: { unpublish: "draft", archive: "archived" },
  archived: { restore: "published" },
};

export function allowedPageActions(status: PageStatus): PageAction[] {
  return Object.keys(PAGE_TRANSITIONS[status]) as PageAction[];
}

/** @throws AppError("INVALID_TRANSITION") when the action is not allowed from `status`. */
export function nextPageStatus(status: PageStatus, action: PageAction): PageStatus {
  const next = PAGE_TRANSITIONS[status][action];
  if (!next) throw new AppError("INVALID_TRANSITION", { from: status, action });
  return next;
}

export function isVisibleToEmployees(status: PageStatus): boolean {
  return status === "published";
}
