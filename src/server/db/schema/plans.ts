import { index, integer, pgTable, primaryKey, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { pages } from "./content";
import { createdAt, primaryUuid, timestamptz } from "./custom-types";
import { phaseEnum } from "./enums";
import { templates } from "./templates";

export const userTemplateAssignments = pgTable(
  "user_template_assignments",
  {
    id: primaryUuid(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamptz("assigned_at").notNull().defaultNow(),
  },
  (t) => [
    unique("uta_user_template_uq").on(t.userId, t.templateId),
    index("uta_template_id_idx").on(t.templateId),
  ],
);

export const userPlanSteps = pgTable(
  "user_plan_steps",
  {
    id: primaryUuid(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "restrict" }),
    phase: phaseEnum("phase").notNull(),
    sortOrder: integer("sort_order").notNull(),
    sourceTemplateId: uuid("source_template_id").references(() => templates.id, {
      onDelete: "set null",
    }),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("ups_user_page_uq").on(t.userId, t.pageId),
    index("ups_user_order_idx").on(t.userId, t.phase, t.sortOrder),
    index("ups_page_id_idx").on(t.pageId),
  ],
);

export const pageCompletions = pgTable(
  "page_completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "restrict" }),
    completedAt: timestamptz("completed_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "page_completions_pk", columns: [t.userId, t.pageId] }),
    index("page_completions_page_id_idx").on(t.pageId),
  ],
);
