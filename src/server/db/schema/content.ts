import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  createdAt,
  primaryUuid,
  timestamptz,
  tsvector,
  updatedAt,
  type TiptapDoc,
} from "./custom-types";
import { pageStatusEnum } from "./enums";
import { departments } from "./org";

export const modules = pgTable(
  "modules",
  {
    id: primaryUuid(),
    titleDe: text("title_de").notNull(),
    titleEn: text("title_en"),
    /** Owner department; NULL = company-wide (admin only). */
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("modules_sort_idx").on(t.sortOrder),
    index("modules_department_id_idx").on(t.departmentId),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: primaryUuid(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "restrict" }),
    status: pageStatusEnum("status").notNull().default("draft"),
    titleDe: text("title_de").notNull(),
    titleEn: text("title_en"),
    contentDe: jsonb("content_de")
      .$type<TiptapDoc>()
      .notNull()
      .default(sql`'{"type":"doc","content":[]}'::jsonb`),
    contentEn: jsonb("content_en").$type<TiptapDoc>(),
    textDe: text("text_de").notNull().default(""),
    textEn: text("text_en"),
    searchDe: tsvector("search_de")
      .notNull()
      .generatedAlwaysAs(
        sql`setweight(to_tsvector('german'::regconfig, coalesce(title_de, '')), 'A') || setweight(to_tsvector('german'::regconfig, coalesce(text_de, '')), 'B')`,
      ),
    searchEn: tsvector("search_en")
      .notNull()
      .generatedAlwaysAs(
        sql`setweight(to_tsvector('english'::regconfig, coalesce(title_en, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(text_en, '')), 'B')`,
      ),
    sortOrder: integer("sort_order").notNull().default(0),
    contentUpdatedAt: timestamptz("content_updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("pages_module_sort_idx").on(t.moduleId, t.sortOrder),
    index("pages_status_idx").on(t.status),
    index("pages_search_de_idx").using("gin", t.searchDe),
    index("pages_search_en_idx").using("gin", t.searchEn),
    check(
      "pages_en_all_or_nothing_ck",
      sql`(${t.titleEn} IS NULL) = (${t.contentEn} IS NULL) AND (${t.titleEn} IS NULL) = (${t.textEn} IS NULL)`,
    ),
  ],
);

export const uploads = pgTable(
  "uploads",
  {
    id: primaryUuid(),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("uploads_storage_key_uq").on(t.storageKey),
    index("uploads_page_id_idx").on(t.pageId),
  ],
);

export const pageEditLocks = pgTable("page_edit_locks", {
  pageId: uuid("page_id")
    .primaryKey()
    .references(() => pages.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  acquiredAt: timestamptz("acquired_at").notNull(),
  expiresAt: timestamptz("expires_at").notNull(),
});
