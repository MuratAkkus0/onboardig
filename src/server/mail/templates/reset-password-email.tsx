import { APP_CONFIG } from "@/config/app";
import type { Locale } from "@/server/auth/types";
import type { EmailTranslator } from "../translator";
import { ActionMail } from "./action-mail";

const SECONDS_PER_MINUTE = 60;

export function ResetPasswordEmail({
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
        preview: t("resetPassword.preview", { appName }),
        heading: t("resetPassword.heading"),
        greeting: t("resetPassword.greeting", { firstName }),
        intro: t("resetPassword.intro", { appName }),
        button: t("resetPassword.button"),
        expiry: t("resetPassword.expiry", {
          minutes: APP_CONFIG.auth.resetPasswordTokenTtlSeconds / SECONDS_PER_MINUTE,
        }),
        fallback: t("common.fallback"),
        ignore: t("resetPassword.ignore"),
      }}
    />
  );
}
