"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import type { ClientNotificationPage } from "@/components/notifications/types";
import { toClientNotification } from "@/components/notifications/types";
import { runAction } from "@/server/actions/run-action";
import { listNotifications, markAllRead, markRead } from "@/server/services/notifications";

export async function markReadAction(id: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await markRead(actor, { id });
    revalidatePath(ROUTES.notifications);
  });
}

export async function markAllReadAction(): Promise<ActionResult> {
  return runAction(async (actor) => {
    await markAllRead(actor);
    revalidatePath(ROUTES.notifications);
  });
}

export async function loadNotificationsAction(
  cursor?: string,
): Promise<ActionResult<ClientNotificationPage>> {
  return runAction(async (actor) => {
    const page = await listNotifications(actor, cursor ? { cursor } : {});
    return { items: page.items.map(toClientNotification), nextCursor: page.nextCursor };
  });
}
