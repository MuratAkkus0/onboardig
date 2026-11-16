import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LandingPage } from "@/components/landing/landing-page";
import { APP_CONFIG, LANDING_CONFIG } from "@/config/app";
import { homeRouteFor } from "@/lib/navigation";
import { getActor } from "@/server/auth/actor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: { absolute: t("meta.title", { appName: APP_CONFIG.appName }) },
    description: t("meta.description"),
    robots: { index: LANDING_CONFIG.robotsIndex, follow: LANDING_CONFIG.robotsIndex },
  };
}

/**
 * "/" is public: signed-in users go to their role's home exactly as before; everyone else (also a
 * stale or expired session cookie) sees the landing page.
 */
export default async function HomePage() {
  const actor = await getActor();
  if (actor) redirect(homeRouteFor(actor.role));
  return <LandingPage />;
}
