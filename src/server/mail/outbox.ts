import "server-only";

export interface OutboxMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

const outbox: OutboxMessage[] = [];

/** Mails captured by the in-memory transport (MAIL_TRANSPORT=memory, tests only). */
export function getOutbox(): readonly OutboxMessage[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}

export function pushToOutbox(message: OutboxMessage): void {
  outbox.push(message);
}
