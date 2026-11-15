"use client";

import { useTranslations } from "next-intl";

/**
 * Resolves a full message key coming from the server (e.g. `errors.CONFLICT`,
 * `validation.required`). Unknown keys fall back to `errors.INTERNAL`, never to raw key text.
 */
export function useMessage(): (key: string, values?: Record<string, string | number>) => string {
  const t = useTranslations();
  return (key, values) =>
    t.has(key as never) ? t(key as never, values as never) : t("errors.INTERNAL");
}
