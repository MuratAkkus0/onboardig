import "server-only";
import { APP_CONFIG } from "@/config/app";
import { logger } from "@/server/logger";
import { sendMail } from "@/server/mail/send";
import { ResetPasswordEmail } from "@/server/mail/templates/reset-password-email";
import { getEmailTranslator } from "@/server/mail/translator";
import { getPasswordResetRecipient } from "@/server/services/invitations";

/**
 * Better Auth `sendResetPassword` callback. Sends nothing to deactivated users or users without
 * a credential password (pending/expired invitation): the request still answers neutrally and the
 * unmailed token is unusable. Failures are logged, never surfaced (no account enumeration).
 */
export async function sendResetPassword(data: {
  user: { id: string };
  url: string;
}): Promise<void> {
  try {
    const recipient = await getPasswordResetRecipient(data.user.id);
    if (!recipient) return;
    const t = await getEmailTranslator(recipient.locale);
    await sendMail({
      to: recipient.email,
      subject: t("resetPassword.subject", { appName: APP_CONFIG.appName }),
      react: ResetPasswordEmail({
        t,
        locale: recipient.locale,
        firstName: recipient.firstName,
        url: data.url,
      }),
    });
  } catch (e) {
    logger.error({ err: e instanceof Error ? e.message : "unknown" }, "reset mail failed");
  }
}
