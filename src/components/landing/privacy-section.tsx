import { Check, Database, EyeOff, Minus, ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { APP_CONFIG, LANDING_CONFIG, V_FB_CONFIG } from "@/config/app";
import { Eyebrow } from "./section-heading";

const STORED = ["completion", "profile", "notifications", "reports", "sessions"] as const;
const NOT_STORED = ["readingTime", "behavior", "analytics", "cookies"] as const;

/** What is stored and what is not recorded: every line must stay literally true (K§5, K§10). */
export function PrivacySection({ index }: { index: number }) {
  const t = useTranslations("landing.privacy");
  const german = (chunks: React.ReactNode) => <span lang="de">{chunks}</span>;
  return (
    <section
      id={LANDING_CONFIG.sectionIds.privacy}
      aria-labelledby={LANDING_CONFIG.headingIds.privacy}
      className="relative isolate scroll-mt-20 overflow-clip border-t py-20 md:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 -right-1/4 -z-10 h-full w-[80%] bg-aurora mask-fade-radial opacity-50"
      />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-5">
          <Eyebrow index={index} label={t("eyebrow")} />
          <h2
            id={LANDING_CONFIG.headingIds.privacy}
            className="mt-4 max-w-[22ch] text-section font-semibold text-balance"
          >
            {t.rich("title", { accent: (chunks) => <span className="text-brand">{chunks}</span> })}
          </h2>
          <p className="mt-6 max-w-[40rem] text-lg leading-relaxed text-pretty text-muted-foreground">
            {t("lead", { appName: APP_CONFIG.appName })}
          </p>
          <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t.rich("legal", { de: german })}</span>
          </p>
        </div>

        <div className="grid items-start gap-4 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          <div className="landing-reveal rounded-2xl border bg-card p-6 text-card-foreground shadow-raised">
            <div className="flex items-center gap-2">
              <Database aria-hidden className="size-5 shrink-0 text-brand" />
              <h3 className="text-base font-semibold">{t("storedTitle")}</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm/6">
              {STORED.map((key) => (
                <li key={key} className="flex gap-2.5">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                  <span className="text-pretty">
                    {t(`stored.${key}`, {
                      days: APP_CONFIG.notifications.retentionDays,
                      reportDays: V_FB_CONFIG.retentionDays,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="landing-reveal rounded-2xl border border-dashed border-muted-foreground/40 bg-background p-6">
            <div className="flex items-center gap-2">
              <EyeOff aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <h3 className="text-base font-semibold">{t("notStoredTitle")}</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm/6">
              {NOT_STORED.map((key) => (
                <li key={key} className="flex gap-2.5">
                  <Minus aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  <span className="text-pretty">{t(`notStored.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="flex items-start gap-2 text-sm text-muted-foreground sm:col-span-2">
            <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="text-pretty">{t("footnote")}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
