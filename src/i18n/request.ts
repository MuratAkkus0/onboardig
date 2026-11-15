import { getRequestConfig } from "next-intl/server";
import { APP_CONFIG } from "@/config/app";
import { loadMessages } from "./messages";
import { resolveLocale } from "./locale";

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: APP_CONFIG.i18n.timeZone,
  };
});
