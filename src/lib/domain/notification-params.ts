import type { Locale } from "@/server/auth/types";

type Params = Record<string, string | number | boolean | null>;

/**
 * Notification params store both language variants of titles (`titleDe`, `titleEn`). Before
 * calling `t(messageKey, params)` this resolves them to one `title` by viewer locale
 * (English falls back to German when there is no English title).
 */
export function resolveNotificationParams(params: Params, locale: Locale): Params {
  const { titleDe, titleEn, ...rest } = params;
  if (titleDe === undefined) return params;
  const title =
    locale === "en" && typeof titleEn === "string" && titleEn !== "" ? titleEn : titleDe;
  return { ...rest, title };
}
