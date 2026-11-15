import { customType, timestamp, uuid } from "drizzle-orm/pg-core";

/** PostgreSQL full text search vector; only ever written by GENERATED columns. */
export const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

/** Minimal shape of a stored Tiptap document; deep validation lives in the content service. */
export interface TiptapDoc {
  type: "doc";
  content?: unknown[];
}

/** `timestamp with time zone` as JS Date. Every `*_at` column uses this. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** `created_at` / `updated_at` pair with the blueprint defaults. */
export const createdAt = () => timestamptz("created_at").notNull().defaultNow();
export const updatedAt = () =>
  timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const primaryUuid = () => uuid("id").primaryKey().defaultRandom();
