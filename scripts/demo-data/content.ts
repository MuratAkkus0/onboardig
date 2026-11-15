import { COMPANY_PAGES } from "./content-company";
import { TECH_PAGES } from "./content-tech";
import type { DemoModule, DemoPage } from "./types";

export const DEMO_MODULES: DemoModule[] = [
  { key: "culture", titleDe: "Willkommen und Kultur", titleEn: "Welcome and culture" },
  { key: "it", titleDe: "IT und Zugänge", titleEn: "IT and access" },
  { key: "engineering", titleDe: "Entwicklung", titleEn: "Engineering" },
  { key: "hr", titleDe: "Personal und Organisation", titleEn: "People and organization" },
  { key: "marketing", titleDe: "Marketing", titleEn: "Marketing" },
];

export const DEMO_PAGES: DemoPage[] = [...COMPANY_PAGES, ...TECH_PAGES];

/** Edit applied to a published page after assignment, so that employees receive `page_updated`. */
export const DEMO_PAGE_UPDATE = {
  pageKey: "wifi",
  extraDe: "Hinweis: Das Gäste-WLAN-Passwort wechselt jetzt jeden Monat und hängt am Empfang aus.",
  extraEn: "Note: the guest Wi-Fi password now changes every month and is posted at the reception.",
} as const;
