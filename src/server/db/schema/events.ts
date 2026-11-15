import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, primaryUuid, timestamptz, updatedAt } from "./custom-types";

export const events = pgTable(
  "events",
  {
    id: primaryUuid(),
    titleDe: text("title_de").notNull(),
    titleEn: text("title_en"),
    descriptionDe: text("description_de").notNull(),
    descriptionEn: text("description_en"),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    location: text("location"),
    lastAnnouncedAt: timestamptz("last_announced_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("events_time_range_ck", sql`${t.endsAt} >= ${t.startsAt}`),
    check(
      "events_en_all_or_nothing_ck",
      sql`(${t.titleEn} IS NULL) = (${t.descriptionEn} IS NULL)`,
    ),
    index("events_starts_at_idx").on(t.startsAt),
  ],
);
