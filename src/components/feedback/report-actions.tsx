"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_STATUSES, V_FB_CONFIG } from "@/config/app";
import { deleteReportAction, updateReportAction } from "@/server/actions/feedback";

type Status = (typeof FEEDBACK_STATUSES)[number];

interface ReportActionsProps {
  id: string;
  subject: string;
  status: Status;
  response: string | null;
  canDelete: boolean;
}

/** Status select, response dialog and (admin only) delete for one report. */
export function ReportActions({ id, subject, status, response, canDelete }: ReportActionsProps) {
  const t = useTranslations("feedback.actions");
  const tEnums = useTranslations("enums");
  const message = useMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<Status>(status);
  const [draftResponse, setDraftResponse] = useState(response ?? "");
  const [error, setError] = useState<string | null>(null);

  function changeStatus(next: Status) {
    startTransition(async () => {
      const result = await updateReportAction({ id, status: next, response });
      if (result.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else {
        toast.error(message(result.error.messageKey));
      }
    });
  }

  function handleDialogOpen(next: boolean) {
    if (next) {
      setDraftStatus(status);
      setDraftResponse(response ?? "");
      setError(null);
    }
    setDialogOpen(next);
  }

  function saveResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateReportAction({
        id,
        status: draftStatus,
        response: draftResponse,
      });
      if (result.ok) {
        toast.success(t("saved"));
        setDialogOpen(false);
        router.refresh();
      } else {
        const key = result.error.fieldErrors?.response?.[0] ?? result.error.messageKey;
        setError(message(key));
      }
    });
  }

  async function remove() {
    const result = await deleteReportAction(id);
    if (result.ok) {
      toast.success(t("deleted"));
      router.refresh();
    } else {
      toast.error(message(result.error.messageKey));
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormField label={t("status")} className="w-44">
        {({ id: controlId, ...control }) => (
          <Select
            value={status}
            disabled={pending}
            onValueChange={(v) => changeStatus(v as Status)}
          >
            <SelectTrigger id={controlId} size="sm" className="w-full" {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEEDBACK_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tEnums(`feedbackStatus.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label={t("editResponseFor", { subject })}>
            <Pencil aria-hidden="true" />
            {t("editResponse")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={saveResponse} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("dialog.title")}</DialogTitle>
              <DialogDescription>{t("dialog.description", { subject })}</DialogDescription>
            </DialogHeader>
            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FormField label={t("status")}>
              {({ id: controlId, ...control }) => (
                <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as Status)}>
                  <SelectTrigger id={controlId} className="w-full" {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tEnums(`feedbackStatus.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField
              label={t("dialog.response")}
              description={t("dialog.counter", {
                count: draftResponse.length,
                max: V_FB_CONFIG.responseMaxLength,
              })}
            >
              {(control) => (
                <Textarea
                  {...control}
                  value={draftResponse}
                  rows={5}
                  maxLength={V_FB_CONFIG.responseMaxLength}
                  onChange={(event) => setDraftResponse(event.target.value)}
                />
              )}
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("dialog.cancel")}
              </Button>
              <SubmitButton pending={pending}>{t("dialog.save")}</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {canDelete ? (
        <ConfirmDialog
          destructive
          title={t("delete.title")}
          description={t("delete.description", { subject })}
          confirmLabel={t("delete.confirm")}
          onConfirm={remove}
          trigger={
            <Button variant="outline" size="sm" aria-label={t("delete.actionFor", { subject })}>
              <Trash2 aria-hidden="true" />
              {t("delete.action")}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
