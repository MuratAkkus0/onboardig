import "server-only";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/i18n/messages";
import type { Locale } from "@/server/auth/types";

/** Translator for the `emails` namespace; works outside of requests. */
export async function getEmailTranslator(locale: Locale) {
  return createTranslator({ locale, messages: await loadMessages(locale), namespace: "emails" });
}

export type EmailTranslator = Awaited<ReturnType<typeof getEmailTranslator>>;
