"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createUserAction, updateUserAction } from "@/app/(app)/admin/users/actions";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALES, ROLES, ROUTES, W1_ORG_CONFIG } from "@/config/app";
import { filterRolesForDepartment, keepFittingRoleId } from "@/lib/domain/job-role-fit";
import { requiredFieldsFor, type RoleBoundField } from "@/lib/validation/users";
import type { Locale } from "@/server/auth/types";
import type { OrgOptions } from "@/server/services/org";
import type { LeadCandidate } from "@/server/services/users";
import { useActionErrorDescriber, type ActionError } from "../use-action-error";

type Role = (typeof ROLES)[number];

export interface UserFormInitial {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  locale: Locale;
  teamId: string | null;
  jobRoleId: string | null;
  leadId: string | null;
  startDate: string | null;
}

interface UserFormProps {
  orgOptions: OrgOptions;
  leadCandidates: LeadCandidate[];
  /** Present when editing an existing user. */
  initial?: UserFormInitial;
  /** Edit only: the e-mail is fixed once the invitation was accepted. */
  emailLocked?: boolean;
}

const NONE = W1_ORG_CONFIG.noneValue;

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  locale: Locale;
  teamId: string;
  jobRoleId: string;
  leadId: string;
  startDate: string;
}

function toValues(initial: UserFormInitial | undefined): Values {
  return {
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    email: initial?.email ?? "",
    role: initial?.role ?? "employee",
    locale: initial?.locale ?? "de",
    teamId: initial?.teamId ?? NONE,
    jobRoleId: initial?.jobRoleId ?? NONE,
    leadId: initial?.leadId ?? NONE,
    startDate: initial?.startDate ?? "",
  };
}

const fromSelect = (value: string): string => (value === NONE ? "" : value);

export function UserForm({
  orgOptions,
  leadCandidates,
  initial,
  emailLocked = false,
}: UserFormProps) {
  const t = useTranslations("users.form");
  const tEnums = useTranslations("enums");
  const tUsers = useTranslations("users");
  const message = useMessage();
  const describe = useActionErrorDescriber();
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => toValues(initial));
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = initial !== undefined;

  const required = new Set<RoleBoundField>(requiredFieldsFor(values.role));
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const departmentOfTeam = (teamId: string): string | null =>
    orgOptions.teams.find((team) => team.id === teamId)?.departmentId ?? null;
  const roleChoices = filterRolesForDepartment(
    orgOptions.jobRoles,
    departmentOfTeam(values.teamId),
  );
  // Changing the team may make the chosen role unfit; clear it then.
  const changeTeam = (teamId: string) =>
    setValues((current) => ({
      ...current,
      teamId,
      jobRoleId:
        keepFittingRoleId(
          orgOptions.jobRoles,
          current.jobRoleId === NONE ? null : current.jobRoleId,
          departmentOfTeam(teamId),
        ) ?? NONE,
    }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      role: values.role,
      locale: values.locale,
      teamId: fromSelect(values.teamId),
      jobRoleId: fromSelect(values.jobRoleId),
      leadId: fromSelect(values.leadId),
      startDate: values.startDate,
    };
    startTransition(async () => {
      setError(null);
      if (initial) {
        const result = await updateUserAction({ ...payload, id: initial.id });
        if (!result.ok) return setError(result.error);
        toast.success(tUsers("toast.saved"));
        return;
      }
      const result = await createUserAction(payload);
      if (!result.ok) return setError(result.error);
      toast.success(tUsers(result.data.inviteSent ? "toast.created" : "toast.createdNoMail"));
      router.push(ROUTES.adminUser(result.data.id));
    });
  }

  const fieldError = (name: string): string | undefined => {
    const key = error?.fieldErrors?.[name]?.[0];
    if (key) return message(key);
    if (name === "email" && error?.code === "EMAIL_TAKEN") return message(error.messageKey);
    return undefined;
  };
  const hasFieldError = Boolean(error?.fieldErrors) || error?.code === "EMAIL_TAKEN";
  const described = error && !hasFieldError ? describe(error) : null;
  const mark = (label: string, field: RoleBoundField) =>
    required.has(field) ? `${label} *` : label;
  const leadOptions = leadCandidates.filter((candidate) => candidate.id !== initial?.id);

  const selectField = (
    label: string,
    name: keyof Values,
    children: React.ReactNode,
    options?: { error?: string; description?: string },
  ) => (
    <FormField label={label} error={options?.error} description={options?.description}>
      {(control) => (
        <Select
          value={values[name]}
          onValueChange={(next) =>
            name === "teamId" ? changeTeam(next) : set(name, next as never)
          }
        >
          <SelectTrigger {...control} className="w-full">
            <SelectValue placeholder={t("select")} />
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
      )}
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {described ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <p>{described.text}</p>
            {described.items.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {described.items.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.person")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={`${t("firstName")} *`} error={fieldError("firstName")}>
            {(control) => (
              <Input
                {...control}
                value={values.firstName}
                onChange={(event) => set("firstName", event.target.value)}
                maxLength={W1_ORG_CONFIG.personNameMaxLength}
                autoComplete="off"
                required
              />
            )}
          </FormField>
          <FormField label={`${t("lastName")} *`} error={fieldError("lastName")}>
            {(control) => (
              <Input
                {...control}
                value={values.lastName}
                onChange={(event) => set("lastName", event.target.value)}
                maxLength={W1_ORG_CONFIG.personNameMaxLength}
                autoComplete="off"
                required
              />
            )}
          </FormField>
          <FormField
            label={`${t("email")} *`}
            error={fieldError("email")}
            description={emailLocked ? t("emailLocked") : editing ? t("emailReinvite") : undefined}
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                {...control}
                type="email"
                value={values.email}
                onChange={(event) => set("email", event.target.value)}
                maxLength={W1_ORG_CONFIG.emailMaxLength}
                autoComplete="off"
                disabled={emailLocked}
                required
              />
            )}
          </FormField>
          {selectField(
            t("locale"),
            "locale",
            LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {tEnums(`locale.${locale}`)}
              </SelectItem>
            )),
            { error: fieldError("locale") },
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.assignment")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {selectField(
            `${t("role")} *`,
            "role",
            ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {tEnums(`role.${role}`)}
              </SelectItem>
            )),
            {
              error: fieldError("role"),
              description:
                values.role === "admin"
                  ? t("adminHint")
                  : t("requiredHint", { lead: String(required.has("leadId")) }),
            },
          )}
          {selectField(
            mark(t("team"), "teamId"),
            "teamId",
            <>
              <SelectItem value={NONE}>{t("none")}</SelectItem>
              {orgOptions.departments.map((department) => (
                <SelectGroup key={department.id}>
                  <SelectLabel>{department.name}</SelectLabel>
                  {orgOptions.teams
                    .filter((team) => team.departmentId === department.id)
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </>,
            { error: fieldError("teamId") },
          )}
          {selectField(
            mark(t("jobRole"), "jobRoleId"),
            "jobRoleId",
            <>
              <SelectItem value={NONE}>{t("none")}</SelectItem>
              {roleChoices.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </>,
            { error: fieldError("jobRoleId") },
          )}
          {selectField(
            mark(t("lead"), "leadId"),
            "leadId",
            <>
              <SelectItem value={NONE}>{t("none")}</SelectItem>
              {leadOptions.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </SelectItem>
              ))}
            </>,
            { error: fieldError("leadId") },
          )}
          <FormField label={mark(t("startDate"), "startDate")} error={fieldError("startDate")}>
            {(control) => (
              <Input
                {...control}
                type="date"
                value={values.startDate}
                onChange={(event) => set("startDate", event.target.value)}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.push(ROUTES.adminUsers)}
        >
          {t("cancel")}
        </Button>
        <SubmitButton pending={pending}>
          {editing ? t("submitEdit") : t("submitCreate")}
        </SubmitButton>
      </div>
    </form>
  );
}
