"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordPathname } from "@/lib/in-app-history";

/** Records in-app page changes for the back button; renders nothing. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    recordPathname(pathname);
  }, [pathname]);
  return null;
}
