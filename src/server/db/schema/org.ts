import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, primaryUuid, updatedAt } from "./custom-types";

export const departments = pgTable(
  "departments",
  {
    id: primaryUuid(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("departments_name_uq").on(t.name)],
);

export const teams = pgTable(
  "teams",
  {
    id: primaryUuid(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("teams_department_name_uq").on(t.departmentId, t.name),
    index("teams_department_id_idx").on(t.departmentId),
  ],
);

export const jobRoles = pgTable(
  "job_roles",
  {
    id: primaryUuid(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("job_roles_name_uq").on(t.name)],
);
