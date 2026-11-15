import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { NotificationList } from "@/components/notifications/notification-list";
import { toClientNotification } from "@/components/notifications/types";
import { requirePageActor } from "@/server/auth/guards";
import { listNotifications } from "@/server/services/notifications";

export default async function NotificationsPage() {
  const actor = await requirePageActor();
  const t = await getTranslations("notifications");
  const page = await listNotifications(actor);
  return (
    <>
      <PageHeader title={t("title")} />
      {page.items.length === 0 ? (
        <EmptyState title={t("list.emptyTitle")} description={t("list.emptyDescription")} />
      ) : (
        <NotificationList
          initialItems={page.items.map(toClientNotification)}
          initialCursor={page.nextCursor}
        />
      )}
    </>
  );
}
