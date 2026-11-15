"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES, W2_TEMPLATES_CONFIG } from "@/config/app";
import { ALL_DEPARTMENTS } from "@/lib/validation/templates";
import type { OrgOptions } from "@/server/services/org";
import { NONE_VALUE, type TemplateFormState } from "./types";

type FormAction = (
  previous: TemplateFormState | null,
  formData: FormData,
) => Promise<TemplateFormState>;

interface TemplateFormProps {
  action: FormAction;
  options: OrgOptions;
  mode: "create" | "edit";
  /** Initial values (edit) as strings; `departmentId` is "all" for company-wide templates. */
  initial?: Record<string, string>;
}

const { nameMaxLength, descriptionMaxLength } = W2_TEMPLATES_CONFIG;

/** Create / edit form for a template. The department has no preselection and is required. */
export function TemplateForm({ action, options, mode, initial = {} }: TemplateFormProps) {
  const message = useMessage();
  const [state, formAction] = useActionState(action, null);
  const values = state?.values ?? initial;
  const error = state && !state.result.ok ? state.result.error : null;
  const fieldError = (name: string) => {
    const key = error?.fieldErrors?.[name]?.[0];
    return key ? message(key) : undefined;
  };
  const generalError =
    error && !error.fieldErrors
      ? message(String(error.details?.reasonKey ?? error.messageKey))
      : null;
  // Keyed so the form picks up the echoed values after a failed submit.
  const formKey = state ? JSON.stringify(state.values) : "initial";

  return (
    <TemplateFormFields
      key={formKey}
      formAction={formAction}
      options={options}
      mode={mode}
      values={values}
      generalError={generalError}
      saved={Boolean(state?.result.ok)}
      fieldError={fieldError}
    />
  );
}

interface FieldsProps {
  formAction: (formData: FormData) => void;
  options: OrgOptions;
  mode: "create" | "edit";
  values: Record<string, string>;
  generalError: string | null;
  saved: boolean;
  fieldError: (name: string) => string | undefined;
}

function TemplateFormFields({
  formAction,
  options,
  mode,
  values,
  generalError,
  saved,
  fieldError,
}: FieldsProps) {
  const t = useTranslations("templates.form");
  const [departmentId, setDepartmentId] = useState(values.departmentId ?? "");
  const [teamId, setTeamId] = useState(values.teamId || NONE_VALUE);
  const [jobRoleId, setJobRoleId] = useState(values.jobRoleId || NONE_VALUE);
  const teamChoices = options.teams.filter((team) => team.departmentId === departmentId);
  const teamsAvailable = departmentId !== "" && departmentId !== ALL_DEPARTMENTS;

  return (
    <form action={formAction} className="max-w-3xl space-y-6" noValidate>
      {generalError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("saved")}
        </p>
      ) : null}
      <Card>
        <CardContent className="space-y-4">
          <FormField label={t("name")} error={fieldError("name")}>
            {(control) => (
              <Input
                {...control}
                name="name"
                required
                maxLength={nameMaxLength}
                defaultValue={values.name ?? ""}
              />
            )}
          </FormField>
          <FormField label={t("description")} error={fieldError("description")}>
            {(control) => (
              <Textarea
                {...control}
                name="description"
                rows={3}
                maxLength={descriptionMaxLength}
                defaultValue={values.description ?? ""}
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label={t("department")}
              error={fieldError("departmentId")}
              description={t("departmentHint")}
            >
              {(control) => (
                <Select
                  name="departmentId"
                  required
                  value={departmentId}
                  onValueChange={(next) => {
                    setDepartmentId(next);
                    setTeamId(NONE_VALUE);
                  }}
                >
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue placeholder={t("departmentPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DEPARTMENTS}>{t("departmentAll")}</SelectItem>
                    {options.departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField
              label={t("team")}
              error={fieldError("teamId")}
              description={departmentId === ALL_DEPARTMENTS ? t("teamHintAll") : undefined}
            >
              {(control) => (
                <Select
                  name="teamId"
                  value={teamId}
                  onValueChange={setTeamId}
                  disabled={!teamsAvailable}
                >
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{t("teamNone")}</SelectItem>
                    {teamChoices.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label={t("jobRole")} error={fieldError("jobRoleId")}>
              {(control) => (
                <Select name="jobRoleId" value={jobRoleId} onValueChange={setJobRoleId}>
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{t("jobRoleNone")}</SelectItem>
                    {options.jobRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{mode === "create" ? t("create") : t("save")}</SubmitButton>
        {mode === "create" ? (
          <Button asChild variant="outline">
            <Link href={ROUTES.adminTemplates}>{t("cancel")}</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
