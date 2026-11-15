import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { pages } from "./content";
import { createdAt, primaryUuid, timestamptz } from "./custom-types";
import { notificationTypeEnum } from "./enums";
import { events } from "./events";

export const notifications = pgTable(
  "notifications",
  {
    id: primaryUuid(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    messageKey: text("message_key").notNull(),
    params: jsonb("params")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    link: text("link"),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    subjectUserId: uuid("subject_user_id").references(() => users.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key"),
    readAt: timestamptz("read_at"),
    createdAt: createdAt(),
    occurredAt: timestamptz("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_feed_idx").on(t.userId, t.occurredAt.desc(), t.id.desc()),
    index("notifications_user_unread_idx")
      .on(t.userId)
      .where(sql`${t.readAt} IS NULL`),
    uniqueIndex("notifications_dedupe_uq")
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.readAt} IS NULL AND ${t.dedupeKey} IS NOT NULL`),
  ],
);
