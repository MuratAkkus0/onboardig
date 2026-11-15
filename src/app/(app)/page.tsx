import { redirect } from "next/navigation";
import { homeRouteFor } from "@/lib/navigation";
import { requirePageActor } from "@/server/auth/guards";

export default async function HomePage() {
  const actor = await requirePageActor();
  redirect(homeRouteFor(actor.role));
}
