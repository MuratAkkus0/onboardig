import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ONBOARDING_STATUSES, ROLES, ROUTES, W1_ORG_CONFIG } from "@/config/app";
import type { OrgOptions } from "@/server/services/org";

export interface UserFilterValues {
  q: string;
  status: string;
  role: string;
  departmentId: string;
  teamId: string;
}

const ALL = W1_ORG_CONFIG.allValue;

/** GET form: the filters live in the URL, the page reads them from `searchParams`. */
export async function UserFilters({
  values,
  orgOptions,
}: {
  values: UserFilterValues;
  orgOptions: OrgOptions;
}) {
  const t = await getTranslations("users.filters");
  const tEnums = await getTranslations("enums");

  const field = (
    name: string,
    label: string,
    value: string,
    options: { value: string; label: string }[],
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`filter-${name}`}>{label}</Label>
      <Select name={name} defaultValue={value || ALL}>
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

  return (
    <Form
      action={ROUTES.adminUsers}
      className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="filter-q">{t("search")}</Label>
        <Input
          id="filter-q"
          name="q"
          type="search"
          defaultValue={values.q}
          placeholder={t("searchPlaceholder")}
        />
      </div>
      {field(
        "status",
        t("status"),
        values.status,
        ONBOARDING_STATUSES.map((status) => ({
          value: status,
          label: tEnums(`onboardingStatus.${status}`),
        })),
      )}
      {field(
        "role",
        t("role"),
        values.role,
        ROLES.map((role) => ({ value: role, label: tEnums(`role.${role}`) })),
      )}
      {field(
        "departmentId",
        t("department"),
        values.departmentId,
        orgOptions.departments.map((department) => ({
          value: department.id,
          label: department.name,
        })),
      )}
      {field(
        "teamId",
        t("team"),
        values.teamId,
        orgOptions.teams.map((team) => ({ value: team.id, label: team.name })),
      )}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit">{t("apply")}</Button>
        <Button variant="outline" asChild>
          <Link href={ROUTES.adminUsers}>{t("reset")}</Link>
        </Button>
      </div>
    </Form>
  );
}
