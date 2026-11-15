import { useTranslations } from "next-intl";
import { getVisibleNavigation, initialsOf } from "@/lib/navigation";
import type { Actor } from "@/server/auth/types";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

/** Responsive shell: top bar always, sidebar from md up, navigation sheet below md. */
export function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const t = useTranslations("common");
  const items = getVisibleNavigation(actor.role);
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        {t("skipToContent")}
      </a>
      <TopBar
        items={items}
        user={{
          name: `${actor.firstName} ${actor.lastName}`.trim(),
          email: actor.email,
          initials: initialsOf(actor.firstName, actor.lastName),
        }}
      />
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r p-4 md:block">
          <SidebarNav items={items} />
        </aside>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
