"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isActiveRoute, type VisibleNavItem } from "@/lib/navigation";
import { NAV_ICONS } from "./nav-icons";

interface SidebarNavProps {
  items: VisibleNavItem[];
  className?: string;
  /** Called after a link was followed (the mobile sheet closes itself). */
  onNavigate?: () => void;
}

/** Role-filtered navigation list; the admin section gets its own heading. */
export function SidebarNav({ items, className, onNavigate }: SidebarNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const main = items.filter((item) => item.section === "main");
  const admin = items.filter((item) => item.section === "admin");

  function renderList(list: VisibleNavItem[]) {
    return (
      <ul className="space-y-1">
        {list.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = isActiveRoute(item.href, pathname);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav aria-label={t("menu.main")} className={cn("space-y-6", className)}>
      {renderList(main)}
      {admin.length > 0 ? (
        <div className="space-y-2">
          <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("sections.admin")}
          </p>
          {renderList(admin)}
        </div>
      ) : null}
    </nav>
  );
}
