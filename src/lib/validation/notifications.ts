import { z } from "zod";
import { F2A_CONFIG } from "@/config/app";
import { idSchema } from "./common";

// Postgres timestamptz text with microseconds ("2026-11-15 22:12:01.123456+00"). The cursor keeps
// the exact text so rows with equal or sub-millisecond timestamps are neither skipped nor repeated.
const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/;

export const notificationCursorSchema = z
  .string()
  .transform((value) => value.split("|"))
  .pipe(z.tuple([z.string().regex(CURSOR_TIMESTAMP), idSchema]));

export const listNotificationsSchema = z.object({
  cursor: notificationCursorSchema.optional(),
  limit: z.number().int().min(1).max(F2A_CONFIG.notifications.maxPageSize).optional(),
});

export const markReadSchema = z.object({ id: idSchema });

export type ListNotificationsInput = z.input<typeof listNotificationsSchema>;
export type MarkReadInput = z.input<typeof markReadSchema>;
