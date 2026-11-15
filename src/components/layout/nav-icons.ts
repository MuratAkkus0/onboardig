import {
  BookOpen,
  Briefcase,
  Building2,
  CalendarCog,
  CalendarDays,
  Layers,
  LayoutDashboard,
  Library,
  ListChecks,
  Search,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/navigation";

/** Maps the icon names of the NAVIGATION config to lucide components. */
export const NAV_ICONS = {
  "list-checks": ListChecks,
  "calendar-days": CalendarDays,
  search: Search,
  users: Users,
  "book-open": BookOpen,
  "layout-dashboard": LayoutDashboard,
  "user-cog": UserCog,
  "building-2": Building2,
  briefcase: Briefcase,
  library: Library,
  layers: Layers,
  "calendar-cog": CalendarCog,
} as const satisfies Record<NavIconName, LucideIcon>;
