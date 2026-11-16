import type { FEEDBACK_TYPES, PHASES } from "@/config/app";
import type { Locale } from "@/server/auth/types";
import type { TiptapDoc } from "@/server/db/schema";

export type Phase = (typeof PHASES)[number];

export interface DemoDepartment {
  key: string;
  name: string;
  teams: { key: string; name: string }[];
}

export interface DemoPage {
  key: string;
  moduleKey: string;
  titleDe: string;
  titleEn: string | null;
  contentDe: TiptapDoc;
  contentEn: TiptapDoc | null;
  /** Final status; "archived" pages are published first, like in real use. */
  status: "draft" | "published" | "archived";
}

export interface DemoModule {
  key: string;
  /** Owner department; null = company-wide (admin only). */
  departmentKey: string | null;
  titleDe: string;
  titleEn: string;
}

export interface DemoTemplate {
  key: string;
  name: string;
  description: string;
  /** Department key, or "all" for a company-wide template. */
  departmentKey: string;
  teamKey: string | null;
  steps: { pageKey: string; phase: Phase }[];
}

export type DemoRole = "admin" | "team_lead" | "employee";

export interface DemoPerson {
  key: string;
  role: DemoRole;
  firstName: string;
  lastName: string;
  email: string;
  locale: Locale;
  teamKey: string | null;
  jobRoleKey: string | null;
  leadKey: string | null;
  /** Days relative to today (negative = already started). */
  startOffsetDays: number | null;
  templateKeys: string[];
  /** How many plan steps the person has completed: a number, or "all". */
  completes: number | "all";
  archived: boolean;
}

export interface DemoEvent {
  key: string;
  titleDe: string;
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  location: string | null;
  /** Days relative to today, plus start hour (Europe/Berlin wall clock is not needed: UTC hours are fine). */
  startOffsetDays: number;
  startHour: number;
  durationHours: number;
  announce: boolean;
}

export interface DemoReport {
  key: string;
  reporterKey: string;
  type: (typeof FEEDBACK_TYPES)[number];
  subject: string;
  message: string;
  /** Demo page the report was sent from; null = the plan overview. */
  pageKey: string | null;
  /** Handler (a demo person) and the final state; null leaves the report open. */
  resolution: { handlerKey: string; status: "in_progress" | "done"; response: string } | null;
}
