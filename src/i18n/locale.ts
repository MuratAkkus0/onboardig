import { cookies, headers } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { getActor } from "@/server/auth/actor";
import type { Locale } from "@/server/auth/types";

function isLocale(value: string | undefined): value is Locale {
  return APP_CONFIG.i18n.locales.some((locale) => locale === value);
}

function fromAcceptLanguage(header: string | null): Locale | undefined {
  if (!header) return undefined;
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2).toLowerCase())
    .find((code) => isLocale(code));
  return isLocale(preferred) ? preferred : undefined;
}

/** actor.locale, then the NEXT_LOCALE cookie, then Accept-Language (de/en), then the default. */
export async function resolveLocale(): Promise<Locale> {
  const actor = await getActor();
  if (actor) return actor.locale;
  const cookie = (await cookies()).get(APP_CONFIG.i18n.localeCookie)?.value;
  if (isLocale(cookie)) return cookie;
  return (
    fromAcceptLanguage((await headers()).get("accept-language")) ?? APP_CONFIG.i18n.defaultLocale
  );
}
