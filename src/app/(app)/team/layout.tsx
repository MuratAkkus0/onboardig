import { requirePageRole } from "@/server/auth/guards";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["team_lead", "admin"]);
  return children;
}
