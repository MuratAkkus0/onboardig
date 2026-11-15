import Link from "next/link";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { APP_CONFIG, ROUTES } from "@/config/app";
import type { VisibleNavItem } from "@/lib/navigation";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

interface TopBarProps {
  items: VisibleNavItem[];
  user: { name: string; email: string; initials: string };
}

export function TopBar({ items, user }: TopBarProps) {
  const t = useTranslations("nav.topBar");
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 sm:px-4">
      <MobileNav items={items} />
      <Link
        href={ROUTES.home}
        aria-label={t("home")}
        className="truncate rounded-md px-1 text-base font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {APP_CONFIG.appName}
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <UserMenu name={user.name} email={user.email} initials={user.initials} />
      </div>
    </header>
  );
}
