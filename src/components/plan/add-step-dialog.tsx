"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addPlanStepAction } from "@/app/(app)/team/[userId]/actions";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
import { failureKey } from "@/components/content/action-feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { PHASES } from "@/config/app";
import type { AddablePage } from "@/server/services/plans";
import { PhaseTitle } from "./phase-title";

interface AddStepDialogProps {
  userId: string;
  pages: AddablePage[];
}

/** Adds a published library page to the plan, at the end of the chosen phase. */
export function AddStepDialog({ userId, pages }: AddStepDialogProps) {
  const t = useTranslations("plan.addStep");
  const message = useMessage();
  const [open, setOpen] = useState(false);
  const [pageId, setPageId] = useState("");
  const [phase, setPhase] = useState<(typeof PHASES)[number] | "">("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPageId("");
      setPhase("");
      setError(undefined);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pageId || !phase) return;
    startTransition(async () => {
      const result = await addPlanStepAction(userId, pageId, phase);
      if (result.ok) {
        toast.success(t("success"));
        setOpen(false);
      } else {
        setError(message(failureKey(result.error)));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Plus aria-hidden="true" />
          {t("action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPages")}</p>
          ) : (
            <>
              <FormField label={t("page")}>
                {(control) => (
                  <Select value={pageId} onValueChange={setPageId}>
                    <SelectTrigger {...control} className="w-full">
                      <SelectValue placeholder={t("pagePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.moduleTitle} / {page.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField label={t("phase")}>
                {(control) => (
                  <Select
                    value={phase}
                    onValueChange={(value) => setPhase(value as (typeof PHASES)[number])}
                  >
                    <SelectTrigger {...control} className="w-full">
                      <SelectValue placeholder={t("phasePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASES.map((value) => (
                        <SelectItem key={value} value={value}>
                          <PhaseTitle phase={value} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <SubmitButton pending={pending} disabled={!pageId || !phase}>
              {t("submit")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
