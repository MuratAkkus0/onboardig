import { z } from "zod";
import { W3_SEARCH_CONFIG } from "@/config/app";

/** Search input: control characters are removed (they are reserved for headline markers). */
export const searchInputSchema = z.object({
  q: z
    .string()
    .transform((value) =>
      value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .pipe(z.string().max(W3_SEARCH_CONFIG.queryMaxLength)),
});

export type SearchInput = z.infer<typeof searchInputSchema>;
