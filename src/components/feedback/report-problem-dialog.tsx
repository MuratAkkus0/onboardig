"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_TYPES, ROUTES, V_FB_CONFIG } from "@/config/app";
import { createReportAction } from "@/server/actions/feedback";

type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Content reports are the likely intent on a content page; everywhere else it is an app problem. */
export function defaultTypeFor(pathname: string): FeedbackType {
  return pathname.startsWith(ROUTES.page("")) ? "content_issue" : "app_bug";
}

/** Sidebar button + dialog for "Problem melden" (all roles). */
export function ReportProblemDialog() {
  const t = useTranslations("feedback");
  const tEnums = useTranslations("enums");
  const message = useMessage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>(() => defaultTypeFor(pathname));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The path is captured when the dialog opens so it does not change while the user is typing.
  const [path, setPath] = useState(pathname);

  function handleOpenChange(next: boolean) {
    if (next) {
      setPath(pathname);
      setType(defaultTypeFor(pathname));
      setFieldErrors({});
      setGeneralError(null);
    }
    setOpen(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setGeneralError(null);
    startTransition(async () => {
      const result = await createReportAction({ type, subject, message: body, path });
      if (result.ok) {
        toast.success(t("dialog.success"));
        setSubject("");
        setBody("");
        setOpen(false);
        return;
      }
      if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors);
      else setGeneralError(message(result.error.messageKey));
    });
  }

  const fieldError = (name: string) => {
    const key = fieldErrors[name]?.[0];
    return key ? message(key) : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-3 px-3 text-muted-foreground">
          <Flag className="size-4 shrink-0" aria-hidden="true" />
          {t("dialog.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>
          {generalError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          ) : null}
          <FormField label={t("dialog.type")} error={fieldError("type")}>
            {({ id, ...control }) => (
              <Select value={type} onValueChange={(value) => setType(value as FeedbackType)}>
                <SelectTrigger id={id} className="w-full" {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tEnums(`feedbackType.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField
            label={t("dialog.subject")}
            error={fieldError("subject")}
            description={t("dialog.counter", {
              count: subject.length,
              max: V_FB_CONFIG.subjectMaxLength,
            })}
          >
            {(control) => (
              <Input
                {...control}
                value={subject}
                maxLength={V_FB_CONFIG.subjectMaxLength}
                autoComplete="off"
                onChange={(event) => setSubject(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            label={t("dialog.message")}
            error={fieldError("message")}
            description={t("dialog.counter", {
              count: body.length,
              max: V_FB_CONFIG.messageMaxLength,
            })}
          >
            {(control) => (
              <Textarea
                {...control}
                value={body}
                rows={5}
                maxLength={V_FB_CONFIG.messageMaxLength}
                onChange={(event) => setBody(event.target.value)}
              />
            )}
          </FormField>
          <p className="text-sm break-all text-muted-foreground">
            <span className="font-medium text-foreground">{t("dialog.path")}: </span>
            <span data-testid="report-path">{path}</span>
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("dialog.cancel")}
            </Button>
            <SubmitButton pending={pending}>{t("dialog.submit")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
