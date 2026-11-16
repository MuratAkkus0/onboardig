import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { pages } from "./content";
import { createdAt, primaryUuid, timestamptz, updatedAt } from "./custom-types";
import { feedbackStatusEnum, feedbackTypeEnum } from "./enums";

/** "Problem melden" reports. Length limits live in `V_FB_CONFIG` and are enforced by zod. */
export const feedbackReports = pgTable(
  "feedback_reports",
  {
    id: primaryUuid(),
    /** NULL once the reporter was deleted; the report stays. */
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    type: feedbackTypeEnum("type").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    /** Same-origin in-app path the report was sent from. */
    path: text("path"),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    status: feedbackStatusEnum("status").notNull().default("open"),
    response: text("response"),
    handledBy: uuid("handled_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    resolvedAt: timestamptz("resolved_at"),
  },
  (t) => [
    index("feedback_reports_status_created_idx").on(t.status, t.createdAt),
    index("feedback_reports_page_id_idx").on(t.pageId),
    index("feedback_reports_reporter_id_idx").on(t.reporterId),
  ],
);
