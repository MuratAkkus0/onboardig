"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { W1_NOTIFY_EVENTS_CONFIG } from "@/config/app";
import type { EventFormState } from "./types";

type FormAction = (previous: EventFormState | null, formData: FormData) => Promise<EventFormState>;

interface EventFormProps {
  action: FormAction;
  /** Initial values (edit) as strings; datetime-local values are Berlin wall-clock time. */
  initial?: Record<string, string>;
}

const { titleMaxLength, descriptionMaxLength, locationMaxLength } = W1_NOTIFY_EVENTS_CONFIG.events;

/** Create / edit form for an event: German fields, optional English pair, time range, location. */
export function EventForm({ action, initial = {} }: EventFormProps) {
  const t = useTranslations("events.form");
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
  // Keyed so uncontrolled inputs pick up the echoed values after a failed submit.
  const formKey = state ? JSON.stringify(state.values) : "initial";

  return (
    <form action={formAction} key={formKey} className="max-w-3xl space-y-6" noValidate>
      {generalError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      ) : null}
      {state?.result.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("saved")}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("sectionDe")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label={t("titleDe")} error={fieldError("titleDe")}>
            {(control) => (
              <Input
                {...control}
                name="titleDe"
                required
                maxLength={titleMaxLength}
                defaultValue={values.titleDe ?? ""}
              />
            )}
          </FormField>
          <FormField label={t("descriptionDe")} error={fieldError("descriptionDe")}>
            {(control) => (
              <Textarea
                {...control}
                name="descriptionDe"
                required
                rows={5}
                maxLength={descriptionMaxLength}
                defaultValue={values.descriptionDe ?? ""}
              />
            )}
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("sectionEn")}</CardTitle>
          <CardDescription>{t("sectionEnHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label={t("titleEn")} error={fieldError("titleEn")}>
            {(control) => (
              <Input
                {...control}
                name="titleEn"
                maxLength={titleMaxLength}
                lang="en"
                defaultValue={values.titleEn ?? ""}
              />
            )}
          </FormField>
          <FormField label={t("descriptionEn")} error={fieldError("descriptionEn")}>
            {(control) => (
              <Textarea
                {...control}
                name="descriptionEn"
                rows={5}
                maxLength={descriptionMaxLength}
                lang="en"
                defaultValue={values.descriptionEn ?? ""}
              />
            )}
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("startsAt")}
            error={fieldError("startsAt")}
            description={t("timeHint")}
          >
            {(control) => (
              <Input
                {...control}
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={values.startsAt ?? ""}
              />
            )}
          </FormField>
          <FormField label={t("endsAt")} error={fieldError("endsAt")}>
            {(control) => (
              <Input
                {...control}
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={values.endsAt ?? ""}
              />
            )}
          </FormField>
          <FormField label={t("location")} error={fieldError("location")} className="sm:col-span-2">
            {(control) => (
              <Input
                {...control}
                name="location"
                maxLength={locationMaxLength}
                defaultValue={values.location ?? ""}
              />
            )}
          </FormField>
        </CardContent>
      </Card>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}
