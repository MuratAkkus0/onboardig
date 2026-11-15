import Link from "next/link";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/app";

/**
 * SLOT STUB (F2b): bell icon linking to /notifications, no unread count.
 * Owned and replaced by W1-notify-events (polling, badge, preview popover).
 */
export function NotificationBell() {
  const t = useTranslations("nav.topBar");
  return (
    <Button asChild variant="ghost" size="icon">
      <Link href={ROUTES.notifications} aria-label={t("notifications")}>
        <Bell aria-hidden="true" />
      </Link>
    </Button>
  );
}
