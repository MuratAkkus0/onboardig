import { AppShell } from "@/components/layout/app-shell";
import { reportsNavKey, type NavBadges } from "@/lib/navigation";
import { requirePageActor } from "@/server/auth/guards";
import { logger } from "@/server/logger";
import { countOpenReports } from "@/server/services/feedback";

/** Open-report count for the navigation badge; leads and admins only, never blocks the page. */
async function loadNavBadges(actor: Awaited<ReturnType<typeof requirePageActor>>) {
  const key = reportsNavKey(actor.role);
  const badges: NavBadges = {};
  if (!key) return badges;
  try {
    badges[key] = await countOpenReports(actor);
  } catch (error) {
    logger.warn({ err: error }, "open report count failed");
  }
  return badges;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const badges = await loadNavBadges(actor);
  return (
    <AppShell actor={actor} badges={badges}>
      {children}
    </AppShell>
  );
}
