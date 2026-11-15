import { useTranslations } from "next-intl";
import type { TemplateListItem } from "@/server/services/templates";

type Scope = Pick<TemplateListItem, "departmentName" | "teamName" | "jobRoleName">;

/** One-line audience of a template: department · team · role (missing parts read "all"). */
export function TemplateScope({ scope }: { scope: Scope }) {
  const t = useTranslations("templates.scope");
  const parts = [
    scope.departmentName ?? t("allDepartments"),
    scope.teamName ?? t("anyTeam"),
    scope.jobRoleName ?? t("anyRole"),
  ];
  return <span>{parts.join(t("separator"))}</span>;
}
