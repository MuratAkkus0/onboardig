"use client";

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createJobRoleAction,
  deleteJobRoleAction,
  getJobRoleUsageAction,
  updateJobRoleAction,
} from "@/app/(app)/admin/job-roles/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DepartmentWithTeams, JobRoleItem } from "@/server/services/org";
import { DeleteEntityDialog } from "./delete-entity-dialog";
import { OrgNameDialog } from "./org-name-dialog";

type DepartmentOption = Pick<DepartmentWithTeams, "id" | "name">;

export function AddJobRoleButton({ departments }: { departments: DepartmentOption[] }) {
  const t = useTranslations("org.jobRoles");
  return (
    <OrgNameDialog
      title={t("form.createTitle")}
      nameLabel={t("form.nameLabel")}
      departmentField={{
        label: t("form.departmentLabel"),
        options: departments,
        initialId: "",
        noneLabel: t("companyWide"),
      }}
      onSubmit={({ name, departmentId }) =>
        createJobRoleAction({ name, departmentId: departmentId || null })
      }
      trigger={
        <Button>
          <Plus aria-hidden="true" />
          {t("add")}
        </Button>
      }
    />
  );
}

export function JobRoleList({
  jobRoles,
  departments,
}: {
  jobRoles: JobRoleItem[];
  departments: DepartmentOption[];
}) {
  const t = useTranslations("org.jobRoles");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columns.name")}</TableHead>
          <TableHead>{t("columns.department")}</TableHead>
          <TableHead>{t("columns.members")}</TableHead>
          <TableHead className="w-24 text-right">
            <span className="sr-only">{t("columns.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobRoles.map((role) => (
          <TableRow key={role.id}>
            <TableCell className="font-medium break-words whitespace-normal">{role.name}</TableCell>
            <TableCell className="break-words whitespace-normal">
              {role.departmentName ?? (
                <span className="text-muted-foreground">{t("companyWide")}</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {t("members", { count: role.userCount })}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <OrgNameDialog
                  title={t("form.editTitle")}
                  nameLabel={t("form.nameLabel")}
                  initialName={role.name}
                  departmentField={{
                    label: t("form.departmentLabel"),
                    options: departments,
                    initialId: role.departmentId ?? "",
                    noneLabel: t("companyWide"),
                  }}
                  onSubmit={({ name, departmentId }) =>
                    updateJobRoleAction({ id: role.id, name, departmentId: departmentId || null })
                  }
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("actions.edit", { name: role.name })}
                      title={t("actions.edit", { name: role.name })}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  }
                />
                <DeleteEntityDialog
                  kind="jobRole"
                  name={role.name}
                  triggerLabel={t("actions.delete", { name: role.name })}
                  loadUsage={() => getJobRoleUsageAction({ id: role.id })}
                  remove={() => deleteJobRoleAction({ id: role.id })}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
