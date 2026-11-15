"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { APP_CONFIG } from "@/config/app";
import type { VisibleNavItem } from "@/lib/navigation";
import { AppLogo } from "./app-logo";
import { SidebarNav } from "./sidebar-nav";

/** Hamburger button + sheet with the same navigation as the sidebar (below the md breakpoint). */
export function MobileNav({ items }: { items: VisibleNavItem[] }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("menu.open")}>
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AppLogo className="size-6 shrink-0" />
            {APP_CONFIG.appName}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("menu.title")}</SheetDescription>
        </SheetHeader>
        <SidebarNav items={items} className="px-4 pb-4" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
