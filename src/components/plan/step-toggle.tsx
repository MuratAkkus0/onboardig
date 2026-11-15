"use client";

import { useTransition } from "react";
import { Check, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setStepCompletionAction } from "@/app/(app)/plan/actions";
import { failureKey } from "@/components/content/action-feedback";
import { useMessage } from "@/components/common/use-message";
import { Button } from "@/components/ui/button";

interface StepToggleProps {
  pageId: string;
  completed: boolean;
}

/** "Erledigt" button, or "Rückgängig" once the step is done (own plan only). */
export function StepToggle({ pageId, completed }: StepToggleProps) {
  const t = useTranslations("plan.step");
  const message = useMessage();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setStepCompletionAction(pageId, !completed);
      if (!result.ok) {
        toast.error(message(failureKey(result.error)));
      } else if (!completed && result.data.status === "completed") {
        toast.success(t("allDoneToast"));
      }
    });
  }

  return completed ? (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={toggle}>
      <Undo2 aria-hidden="true" />
      {t("undo")}
    </Button>
  ) : (
    <Button type="button" size="sm" disabled={pending} onClick={toggle}>
      <Check aria-hidden="true" />
      {t("markDone")}
    </Button>
  );
}
