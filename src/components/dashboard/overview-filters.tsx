import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ONBOARDING_STATUSES, ROUTES, W1_ORG_CONFIG } from "@/config/app";
import type { OrgOptions } from "@/server/services/org";

export interface OverviewFilterValues {
  departmentId: string;
  teamId: string;
  status: string;
}

const ALL = W1_ORG_CONFIG.allValue;

/** GET form: the filters live in the URL, the admin page reads them from `searchParams`. */
export async function OverviewFilters({
  values,
  orgOptions,
}: {
  values: OverviewFilterValues;
  orgOptions: Pick<OrgOptions, "departments" | "teams">;
}) {
  const t = await getTranslations("dashboard.filters");
  const tEnums = await getTranslations("enums");

  const field = (
    name: keyof OverviewFilterValues,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`filter-${name}`}>{label}</Label>
      <Select name={name} defaultValue={values[name] || ALL}>
        <SelectTrigger id={`filter-${name}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("all")}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const departmentName = new Map(orgOptions.departments.map((d) => [d.id, d.name]));
  return (
    <Form action={ROUTES.admin} className="mb-6 grid gap-4 sm:grid-cols-3 sm:items-end">
      {field(
        "departmentId",
        t("department"),
        orgOptions.departments.map((d) => ({ value: d.id, label: d.name })),
      )}
      {field(
        "teamId",
        t("team"),
        orgOptions.teams.map((team) => ({
          value: team.id,
          label: `${team.name} (${departmentName.get(team.departmentId) ?? ""})`,
        })),
      )}
      {field(
        "status",
        t("status"),
        ONBOARDING_STATUSES.map((status) => ({
          value: status,
          label: tEnums(`onboardingStatus.${status}`),
        })),
      )}
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit">{t("apply")}</Button>
        <Button variant="outline" asChild>
          <Link href={ROUTES.admin}>{t("reset")}</Link>
        </Button>
      </div>
    </Form>
  );
}
