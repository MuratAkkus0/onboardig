"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { removePlanStepAction } from "@/app/(app)/team/[userId]/actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useMessage } from "@/components/common/use-message";
import { failureKey } from "@/components/content/action-feedback";
import { Button } from "@/components/ui/button";

interface RemoveStepButtonProps {
  userId: string;
  pageId: string;
  /** Page title for the accessible name; `null` when the viewer may not see it. */
  title: string | null;
}

/** Removes a step from the plan after confirmation (the completion record is kept). */
export function RemoveStepButton({ userId, pageId, title }: RemoveStepButtonProps) {
  const t = useTranslations("plan.removeStep");
  const tMember = useTranslations("plan.member");
  const message = useMessage();

  async function remove() {
    const result = await removePlanStepAction(userId, pageId);
    if (result.ok) toast.success(t("success"));
    else toast.error(message(failureKey(result.error)));
  }

  return (
    <ConfirmDialog
      destructive
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      onConfirm={remove}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("actionLabel", { title: title ?? tMember("hiddenTitle") })}
        >
          <Trash2 aria-hidden="true" />
          {t("action")}
        </Button>
      }
    />
  );
}
