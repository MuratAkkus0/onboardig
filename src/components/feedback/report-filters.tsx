"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, V_FB_CONFIG } from "@/config/app";

interface ReportFiltersProps {
  basePath: string;
  status: string | null;
  type: string | null;
}

const { filterAll, filterParams } = V_FB_CONFIG;

/** Status and type filters; the selection lives in the URL so the list stays a server render. */
export function ReportFilters({ basePath, status, type }: ReportFiltersProps) {
  const t = useTranslations("feedback.filters");
  const tEnums = useTranslations("enums");
  const router = useRouter();

  function change(name: string, value: string) {
    const params = new URLSearchParams();
    const next = { [filterParams.status]: status, [filterParams.type]: type, [name]: value };
    for (const [key, current] of Object.entries(next)) {
      if (current && current !== filterAll) params.set(key, current);
    }
    const query = params.toString();
    router.replace(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <div className="flex flex-wrap items-end gap-4 pb-4" role="group" aria-label={t("label")}>
      <FormField label={t("status")} className="w-48">
        {({ id, ...control }) => (
          <Select
            value={status ?? filterAll}
            onValueChange={(value) => change(filterParams.status, value)}
          >
            <SelectTrigger id={id} className="w-full" {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={filterAll}>{t("all")}</SelectItem>
              {FEEDBACK_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tEnums(`feedbackStatus.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label={t("type")} className="w-56">
        {({ id, ...control }) => (
          <Select
            value={type ?? filterAll}
            onValueChange={(value) => change(filterParams.type, value)}
          >
            <SelectTrigger id={id} className="w-full" {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={filterAll}>{t("all")}</SelectItem>
              {FEEDBACK_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tEnums(`feedbackType.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
    </div>
  );
}
