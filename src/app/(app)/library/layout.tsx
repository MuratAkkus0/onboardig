import { requirePageRole } from "@/server/auth/guards";

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["team_lead", "admin"]);
  return children;
}
