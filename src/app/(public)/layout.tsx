import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { cn } from "@/lib/utils";

/**
 * Public pages without an auth guard (the landing page at "/"). Geist is self-hosted by
 * next/font/local (files ship with the build, no network request) and scoped to this group, so
 * the signed-in app keeps its system font stack.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(GeistSans.variable, GeistMono.variable, "font-landing")}>{children}</div>
  );
}
