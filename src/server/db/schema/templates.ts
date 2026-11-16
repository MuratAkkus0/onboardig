import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { pages } from "./content";
import { createdAt, primaryUuid, updatedAt } from "./custom-types";
import { phaseEnum, templateStatusEnum } from "./enums";
import { departments, jobRoles, teams } from "./org";

export const templates = pgTable(
  "templates",
  {
    id: primaryUuid(),
    name: text("name").notNull(),
    description: text("description"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    jobRoleId: uuid("job_role_id").references(() => jobRoles.id, { onDelete: "restrict" }),
    status: templateStatusEnum("status").notNull().default("active"),
    /** Created by a team lead: managed by the leads of `department_id` and by admins. */
    leadManaged: boolean("lead_managed").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "templates_team_requires_department_ck",
      sql`${t.teamId} IS NULL OR ${t.departmentId} IS NOT NULL`,
    ),
    index("templates_department_id_idx").on(t.departmentId),
    index("templates_status_idx").on(t.status),
  ],
);

export const templateSteps = pgTable(
  "template_steps",
  {
    id: primaryUuid(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "restrict" }),
    phase: phaseEnum("phase").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique("template_steps_template_page_uq").on(t.templateId, t.pageId),
    index("template_steps_order_idx").on(t.templateId, t.phase, t.sortOrder),
    index("template_steps_page_id_idx").on(t.pageId),
  ],
);
