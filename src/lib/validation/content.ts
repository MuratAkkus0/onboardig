import { z } from "zod";
import { PAGE_STATUSES, W1_CONTENT_CONFIG } from "@/config/app";
import { isEmptyDoc } from "@/lib/domain/locale-content";
import { idSchema, optionalText, tiptapDocSchema } from "@/lib/validation/common";

const requiredTitle = z.string().trim().min(1).max(W1_CONTENT_CONFIG.titleMaxLength);
// A missing, null or blank English title all become null.
const optionalTitle = optionalText
  .pipe(z.string().max(W1_CONTENT_CONFIG.titleMaxLength).nullable())
  .default(null);

export const directionSchema = z.enum(["up", "down"]);
export type Direction = z.infer<typeof directionSchema>;

export const pageActionSchema = z.enum(["publish", "unpublish", "archive", "restore"]);

export const idInputSchema = z.object({ id: idSchema });

export const createModuleSchema = z.object({ titleDe: requiredTitle, titleEn: optionalTitle });
export const updateModuleSchema = createModuleSchema.extend({ id: idSchema });
export const moveSchema = z.object({ id: idSchema, direction: directionSchema });

export const createPageSchema = z.object({ moduleId: idSchema, titleDe: requiredTitle });
export const movePageToModuleSchema = z.object({ id: idSchema, moduleId: idSchema });
export const changePageStatusSchema = z.object({ id: idSchema, action: pageActionSchema });
export const deletePageSchema = z.object({
  id: idSchema,
  confirmName: z.string().optional(),
});
export const listLibrarySchema = z.object({ status: z.enum(PAGE_STATUSES).optional() });

/** EN title and EN content are either both filled or both empty (blueprint section 2.3). */
export const savePageContentSchema = z
  .object({
    id: idSchema,
    titleDe: requiredTitle,
    titleEn: optionalTitle,
    contentDe: tiptapDocSchema,
    contentEn: tiptapDocSchema.nullish(),
  })
  .superRefine((value, ctx) => {
    const hasTitle = value.titleEn !== null;
    const hasContent = value.contentEn != null && !isEmptyDoc(value.contentEn);
    if (hasTitle && !hasContent) {
      ctx.addIssue({
        code: "custom",
        path: ["contentEn"],
        message: "editor.errors.englishIncomplete",
      });
    }
    if (hasContent && !hasTitle) {
      ctx.addIssue({
        code: "custom",
        path: ["titleEn"],
        message: "editor.errors.englishIncomplete",
      });
    }
  });

export const pageIdInputSchema = z.object({ pageId: idSchema });

export const uploadImageSchema = z.object({
  pageId: idSchema,
  fileName: z.string().max(1000),
  bytes: z.instanceof(Uint8Array),
});

export type CreateModuleInput = z.input<typeof createModuleSchema>;
export type UpdateModuleInput = z.input<typeof updateModuleSchema>;
export type SavePageContentInput = z.input<typeof savePageContentSchema>;
