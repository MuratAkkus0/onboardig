"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ReportProblemDialog } from "@/components/feedback/report-problem-dialog";
import { V_FB_CONFIG } from "@/config/app";
import { cn } from "@/lib/utils";
import { activeNavHref, type VisibleNavItem } from "@/lib/navigation";
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
  const activeHref = activeNavHref(
    items.map((item) => item.href),
    pathname,
  );

  function renderList(list: VisibleNavItem[]) {
    return (
      <ul className="space-y-1">
        {list.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = item.href === activeHref;
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
                <span className="min-w-0 flex-1 truncate">{t(item.key)}</span>
                {item.badge ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                    >
                      {item.badge > V_FB_CONFIG.badgeMax ? `${V_FB_CONFIG.badgeMax}+` : item.badge}
                    </span>
                    <span className="sr-only">{t("badge.open", { count: item.badge })}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <nav aria-label={t("menu.main")} className="space-y-6">
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
      <div className="border-t pt-4">
        <ReportProblemDialog onSubmitted={onNavigate} />
      </div>
    </div>
  );
}
