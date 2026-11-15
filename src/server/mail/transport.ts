import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";
import { pushToOutbox, type OutboxMessage } from "./outbox";

const globalForMail = globalThis as unknown as { __onboardingMailTransport?: Transporter };

function createTransport(): Transporter {
  if (env.MAIL_TRANSPORT === "memory") return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
  });
}

/** Sends one message through the configured transport (SMTP, or the memory outbox in tests). */
export async function deliver(message: Omit<OutboxMessage, "from">): Promise<void> {
  globalForMail.__onboardingMailTransport ??= createTransport();
  const full = { from: env.MAIL_FROM, ...message };
  await globalForMail.__onboardingMailTransport.sendMail(full);
  if (env.MAIL_TRANSPORT === "memory") pushToOutbox(full);
}
