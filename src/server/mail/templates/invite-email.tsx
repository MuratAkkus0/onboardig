import { APP_CONFIG } from "@/config/app";
import type { Locale } from "@/server/auth/types";
import type { EmailTranslator } from "../translator";
import { ActionMail } from "./action-mail";

export function InviteEmail({
  t,
  locale,
  firstName,
  url,
}: {
  t: EmailTranslator;
  locale: Locale;
  firstName: string;
  url: string;
}) {
  const appName = APP_CONFIG.appName;
  return (
    <ActionMail
      locale={locale}
      url={url}
      texts={{
        preview: t("invite.preview", { appName }),
        heading: t("invite.heading", { appName }),
        greeting: t("invite.greeting", { firstName }),
        intro: t("invite.intro", { appName }),
        button: t("invite.button"),
        expiry: t("invite.expiry", { hours: APP_CONFIG.auth.inviteTokenTtlHours }),
        fallback: t("common.fallback"),
        ignore: t("invite.ignore"),
      }}
    />
  );
}
