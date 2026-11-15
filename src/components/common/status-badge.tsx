import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ONBOARDING_STATUSES, PAGE_STATUSES, TEMPLATE_STATUSES } from "@/config/app";

type Props =
  | { kind: "onboardingStatus"; value: (typeof ONBOARDING_STATUSES)[number] }
  | { kind: "pageStatus"; value: (typeof PAGE_STATUSES)[number] }
  | { kind: "templateStatus"; value: (typeof TEMPLATE_STATUSES)[number] };

type Variant = "default" | "secondary" | "outline";

const VARIANT_BY_VALUE: Record<string, Variant> = {
  active: "default",
  published: "default",
  completed: "secondary",
  draft: "outline",
  archived: "outline",
};

/** Badge for any status enum; the label comes from `enums.<kind>.<value>`. */
export function StatusBadge({ kind, value }: Props) {
  const t = useTranslations("enums");
  const label = t(`${kind}.${value}` as never);
  return <Badge variant={VARIANT_BY_VALUE[value] ?? "outline"}>{label}</Badge>;
}
