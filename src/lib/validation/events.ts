import { z } from "zod";
import { W1_NOTIFY_EVENTS_CONFIG } from "@/config/app";
import { idSchema, optionalText } from "./common";

const { titleMaxLength, descriptionMaxLength, locationMaxLength } = W1_NOTIFY_EVENTS_CONFIG.events;

const instant = z
  .union([z.date(), z.string().min(1)])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), { error: "validation.invalid" });

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalBounded = (max: number) =>
  optionalText
    .refine((value) => value === null || value.length <= max, {
      error: "validation.tooLong",
    })
    .default(null);

/** Event input. English title and description are both filled or both empty (blueprint 2.3). */
export const eventInputSchema = z
  .object({
    titleDe: requiredText(titleMaxLength),
    descriptionDe: requiredText(descriptionMaxLength),
    titleEn: optionalBounded(titleMaxLength),
    descriptionEn: optionalBounded(descriptionMaxLength),
    startsAt: instant,
    endsAt: instant,
    location: optionalBounded(locationMaxLength),
  })
  .superRefine((value, ctx) => {
    if (value.endsAt.getTime() < value.startsAt.getTime()) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "events.errors.endBeforeStart" });
    }
    if ((value.titleEn === null) !== (value.descriptionEn === null)) {
      const missing = value.titleEn === null ? "titleEn" : "descriptionEn";
      ctx.addIssue({ code: "custom", path: [missing], message: "validation.required" });
    }
  });

export const eventIdSchema = z.object({ id: idSchema });

export type EventInput = z.input<typeof eventInputSchema>;
export type UpdateEventInput = EventInput & { id: string };
