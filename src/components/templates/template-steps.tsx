"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  addTemplateStepAction,
  changeTemplateStepPhaseAction,
  moveTemplateStepAction,
  removeTemplateStepAction,
} from "@/app/(app)/admin/templates/actions";
import { FormField } from "@/components/common/form-field";
import { useActionFeedback } from "@/components/content/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { PickerPage } from "@/server/services/pages";
import type { TemplateDetail, TemplateStepDto } from "@/server/services/templates";

type Phase = (typeof PHASES)[number];

interface TemplateStepsProps {
  templateId: string;
  phases: TemplateDetail["phases"];
  /** Library pages that may be added (the dialog hides the ones already in the template). */
  pages: PickerPage[];
}

/** Steps of a template grouped by phase with add, remove, up/down and phase change. */
export function TemplateSteps({ templateId, phases, pages }: TemplateStepsProps) {
  const t = useTranslations("templates");
  const tPhase = useTranslations("enums.phase");
  const usedPageIds = new Set(phases.flatMap((entry) => entry.steps.map((step) => step.pageId)));
  const addable = pages.filter((page) => page.status !== "archived" && !usedPageIds.has(page.id));

  return (
    <section aria-labelledby="template-steps-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="template-steps-heading" className="text-lg font-semibold">
            {t("detail.stepsHeading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("detail.stepsDescription")}</p>
        </div>
        <AddStepDialog templateId={templateId} pages={addable} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {phases.map(({ phase, steps }) => (
          <Card key={phase}>
            <CardHeader>
              <CardTitle className="text-base">{tPhase(phase)}</CardTitle>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("steps.emptyPhase")}</p>
              ) : (
                <ol className="divide-y rounded-md border">
                  {steps.map((step, index) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      phase={phase}
                      isFirst={index === 0}
                      isLast={index === steps.length - 1}
                    />
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function StepRow({
  step,
  phase,
  isFirst,
  isLast,
}: {
  step: TemplateStepDto;
  phase: Phase;
  isFirst: boolean;
  isLast: boolean;
}) {
  const t = useTranslations("templates");
  const tPhase = useTranslations("enums.phase");
  const run = useActionFeedback();
  const [pending, startTransition] = useTransition();

  function act(action: () => ReturnType<typeof moveTemplateStepAction>, success?: string) {
    startTransition(async () => {
      await run(action, success);
    });
  }

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-medium break-words">{step.title}</p>
        <p className="text-sm break-words text-muted-foreground">{step.moduleTitle}</p>
        {step.pageStatus !== "published" ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {step.pageStatus === "archived" ? t("steps.archived") : t("steps.draft")}
            </Badge>
            {step.pageStatus === "archived" ? t("steps.archivedHint") : t("steps.draftHint")}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Select
          value={phase}
          disabled={pending}
          onValueChange={(next) =>
            act(() => changeTemplateStepPhaseAction({ stepId: step.id, phase: next as Phase }))
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("steps.phaseLabel", { title: step.title })}
            className="w-36"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHASES.map((value) => (
              <SelectItem key={value} value={value}>
                {tPhase(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending || isFirst}
          aria-label={t("steps.moveUp", { title: step.title })}
          title={t("steps.moveUp", { title: step.title })}
          onClick={() => act(() => moveTemplateStepAction({ stepId: step.id, direction: "up" }))}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending || isLast}
          aria-label={t("steps.moveDown", { title: step.title })}
          title={t("steps.moveDown", { title: step.title })}
          onClick={() => act(() => moveTemplateStepAction({ stepId: step.id, direction: "down" }))}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={t("steps.remove", { title: step.title })}
          title={t("steps.remove", { title: step.title })}
          onClick={() =>
            act(() => removeTemplateStepAction({ stepId: step.id }), t("toast.stepRemoved"))
          }
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

function AddStepDialog({ templateId, pages }: { templateId: string; pages: PickerPage[] }) {
  const t = useTranslations("templates");
  const tPhase = useTranslations("enums.phase");
  const tCommon = useTranslations("common");
  const run = useActionFeedback();
  const [open, setOpen] = useState(false);
  const [pageId, setPageId] = useState("");
  const [phase, setPhase] = useState<Phase>("first_day");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setPageId("");
  }

  function submit() {
    startTransition(async () => {
      const result = await run(
        () => addTemplateStepAction({ templateId, pageId, phase }),
        t("toast.stepAdded"),
      );
      if (result.ok) handleOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          {t("addStep.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addStep.title")}</DialogTitle>
        </DialogHeader>
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("addStep.noPages")}</p>
        ) : (
          <div className="space-y-4">
            <FormField label={t("addStep.page")}>
              {(control) => (
                <Select value={pageId} onValueChange={setPageId}>
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue placeholder={t("addStep.pagePlaceholder")} />
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
            <FormField label={t("addStep.phase")}>
              {(control) => (
                <Select value={phase} onValueChange={(next) => setPhase(next as Phase)}>
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tPhase(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon("actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={pageId === "" || pending}
            aria-busy={pending}
            onClick={submit}
          >
            {t("addStep.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
