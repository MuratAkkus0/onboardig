import { useTranslations } from "next-intl";
import { ONBOARDING_STATUSES } from "@/config/app";
import type { OverviewSummary as Summary } from "./summary";

export function OverviewSummary({ summary }: { summary: Summary }) {
  const t = useTranslations("dashboard.summary");
  const tEnums = useTranslations("enums");
  const items = [
    { key: "total", label: t("total"), value: String(summary.total) },
    ...ONBOARDING_STATUSES.map((status) => ({
      key: status,
      label: tEnums(`onboardingStatus.${status}`),
      value: String(summary.byStatus[status]),
    })),
    { key: "average", label: t("averageProgress"), value: `${summary.averagePercent}%` },
  ];
  return (
    <dl
      className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      aria-label={t("label")}
    >
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border bg-card p-4 text-card-foreground">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
