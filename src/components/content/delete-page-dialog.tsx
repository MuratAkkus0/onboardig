"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PageDeletionImpact } from "@/server/services/pages";
import { deletePageAction, getPageDeletionImpactAction } from "@/app/(app)/admin/library/actions";
import { useActionFeedback } from "./action-feedback";

interface DeletePageDialogProps {
  page: { id: string; titleDe: string; status: "draft" | "published" | "archived" };
  onClose: () => void;
}

/**
 * K§8: unused pages are deleted after a simple confirmation; used pages are archived and the
 * admin must type the title. Mount it only while it is open (it loads the impact on mount).
 */
export function DeletePageDialog({ page, onClose }: DeletePageDialogProps) {
  const t = useTranslations("library");
  const common = useTranslations("common");
  const run = useActionFeedback();
  const [impact, setImpact] = useState<PageDeletionImpact | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getPageDeletionImpactAction({ id: page.id }).then((result) => {
      if (cancelled) return;
      if (result.ok) setImpact(result.data);
      else onClose();
    });
    return () => {
      cancelled = true;
    };
  }, [page.id, onClose]);

  const used = impact?.used ?? false;
  const blocked = used && page.status === "archived";
  const matches = !used || typed === page.titleDe;
  const impactLines = impact
    ? [
        impact.activePlanCount > 0 ? t("delete.headline", { count: impact.activePlanCount }) : null,
        impact.templateCount > 0 ? t("delete.templates", { count: impact.templateCount }) : null,
        impact.planCount > 0 ? t("delete.plans", { count: impact.planCount }) : null,
        impact.completionCount > 0
          ? t("delete.completions", { count: impact.completionCount })
          : null,
      ].filter((line): line is string => line !== null)
    : [];

  function confirm() {
    startTransition(async () => {
      const result = await run(() =>
        deletePageAction({ id: page.id, ...(used ? { confirmName: typed } : {}) }),
      );
      if (result.ok) {
        toast.success(
          result.data.result === "deleted" ? t("toast.pageDeleted") : t("toast.pageArchived"),
        );
        onClose();
      }
    });
  }

  const title = !impact
    ? t("delete.simpleTitle")
    : used
      ? t("delete.usedTitle")
      : t("delete.simpleTitle");
  const description = !impact
    ? t("delete.loading")
    : blocked
      ? t("errors.pageInUse")
      : used
        ? t("delete.usedDescription", { name: page.titleDe })
        : t("delete.simpleDescription", { name: page.titleDe });

  return (
    <AlertDialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {impactLines.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {impactLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {used && !blocked ? (
          <FormField
            label={common("confirm.typeToConfirmLabel")}
            description={common("confirm.typeToConfirm", { name: page.titleDe })}
          >
            {(control) => (
              <Input
                {...control}
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            )}
          </FormField>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{common("actions.cancel")}</AlertDialogCancel>
          {impact && !blocked ? (
            <Button
              variant={used ? "default" : "destructive"}
              disabled={!matches || pending}
              onClick={confirm}
            >
              {used ? t("delete.usedConfirm") : common("actions.delete")}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
