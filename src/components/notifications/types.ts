import type { NotificationDto } from "@/server/services/notifications";

type Params = Record<string, string | number | boolean | null>;

/** Serializable notification as the client components use it (also the poll endpoint's JSON shape). */
export interface ClientNotification {
  id: string;
  type: NotificationDto["type"];
  messageKey: string;
  params: Params;
  link: string | null;
  read: boolean;
  occurredAt: string;
}

export interface ClientNotificationPage {
  items: ClientNotification[];
  nextCursor: string | null;
}

export function toClientNotification(dto: NotificationDto): ClientNotification {
  return {
    id: dto.id,
    type: dto.type,
    messageKey: dto.messageKey,
    params: dto.params as Params,
    link: dto.link,
    read: dto.read,
    occurredAt: dto.occurredAt.toISOString(),
  };
}
