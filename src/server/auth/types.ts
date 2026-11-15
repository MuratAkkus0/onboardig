import type { LOCALES, ROLES, THEMES } from "@/config/app";

export type Role = (typeof ROLES)[number];
export type Locale = (typeof LOCALES)[number];
export type Theme = (typeof THEMES)[number];

export interface Actor {
  id: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
  locale: Locale;
  theme: Theme;
}
