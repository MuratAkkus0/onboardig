import { AppShell } from "@/components/layout/app-shell";
import { requirePageActor } from "@/server/auth/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  return <AppShell actor={actor}>{children}</AppShell>;
}
