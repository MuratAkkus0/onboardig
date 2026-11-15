import "server-only";
import { logger } from "@/server/logger";

/**
 * Better Auth `sendResetPassword` callback. Stub: F2a implements the mail (and the rule that
 * users without a credential password or deactivated users get nothing).
 */
export async function sendResetPassword(): Promise<void> {
  logger.warn("reset mail not implemented");
}
