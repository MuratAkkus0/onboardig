"use client";

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createDepartmentAction,
  createTeamAction,
  deleteDepartmentAction,
  deleteTeamAction,
  getDepartmentUsageAction,
  getTeamUsageAction,
  updateDepartmentAction,
  updateTeamAction,
} from "@/app/(app)/admin/org/actions";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepartmentWithTeams } from "@/server/services/org";
import { DeleteEntityDialog } from "./delete-entity-dialog";
import { OrgNameDialog } from "./org-name-dialog";

export function AddDepartmentButton() {
  const t = useTranslations("org.departments");
  return (
    <OrgNameDialog
      title={t("form.createTitle")}
      nameLabel={t("form.nameLabel")}
      onSubmit={({ name }) => createDepartmentAction({ name })}
      trigger={
        <Button>
          <Plus aria-hidden="true" />
          {t("add")}
        </Button>
      }
    />
  );
}

export function DepartmentList({ departments }: { departments: DepartmentWithTeams[] }) {
  const t = useTranslations("org.departments");
  const departmentOptions = departments.map(({ id, name }) => ({ id, name }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {departments.map((department) => (
        <Card key={department.id}>
          <CardHeader>
            <CardTitle className="break-words">{department.name}</CardTitle>
            <CardAction className="flex items-center gap-1">
              <OrgNameDialog
                title={t("form.editTitle")}
                nameLabel={t("form.nameLabel")}
                initialName={department.name}
                onSubmit={({ name }) => updateDepartmentAction({ id: department.id, name })}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("actions.edit", { name: department.name })}
                    title={t("actions.edit", { name: department.name })}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                }
              />
              <DeleteEntityDialog
                kind="department"
                name={department.name}
                triggerLabel={t("actions.delete", { name: department.name })}
                loadUsage={() => getDepartmentUsageAction({ id: department.id })}
                remove={() => deleteDepartmentAction({ id: department.id })}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">{t("teamsHeading")}</h3>
            {department.teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noTeams")}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {department.teams.map((team) => (
                  <li key={team.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{team.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("members", { count: team.userCount })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <OrgNameDialog
                        title={t("teamForm.editTitle")}
                        nameLabel={t("teamForm.nameLabel")}
                        initialName={team.name}
                        departmentField={{
                          label: t("teamForm.departmentLabel"),
                          options: departmentOptions,
                          initialId: team.departmentId,
                        }}
                        onSubmit={({ name, departmentId }) =>
                          updateTeamAction({ id: team.id, name, departmentId })
                        }
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("actions.editTeam", { name: team.name })}
                            title={t("actions.editTeam", { name: team.name })}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        }
                      />
                      <DeleteEntityDialog
                        kind="team"
                        name={team.name}
                        triggerLabel={t("actions.deleteTeam", { name: team.name })}
                        loadUsage={() => getTeamUsageAction({ id: team.id })}
                        remove={() => deleteTeamAction({ id: team.id })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <OrgNameDialog
              title={t("teamForm.createTitle")}
              nameLabel={t("teamForm.nameLabel")}
              onSubmit={({ name }) => createTeamAction({ departmentId: department.id, name })}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus aria-hidden="true" />
                  {t("addTeam")}
                </Button>
              }
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
