import { useTranslations } from "next-intl";
import type { PHASES } from "@/config/app";

/** Localized phase label (`enums.phase.*`, the K§5 wording). */
export function PhaseTitle({ phase }: { phase: (typeof PHASES)[number] }) {
  const t = useTranslations("enums.phase");
  return <>{t(phase)}</>;
}
