"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { dismissStepUpdateAction } from "@/app/(app)/plan/actions";
import { failureKey } from "@/components/content/action-feedback";
import { useMessage } from "@/components/common/use-message";
import { Badge } from "@/components/ui/badge";

/** "Seit deinem Abschluss aktualisiert" badge with a one-click dismiss (own plan only). */
export function UpdatedBadge({ pageId }: { pageId: string }) {
  const t = useTranslations("plan");
  const message = useMessage();
  const [pending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      const result = await dismissStepUpdateAction(pageId);
      if (!result.ok) toast.error(message(failureKey(result.error)));
    });
  }

  return (
    <Badge variant="secondary" className="gap-0.5 pr-0.5">
      {t("updatedSinceCompletion")}
      <button
        type="button"
        onClick={dismiss}
        disabled={pending}
        aria-label={t("step.dismissUpdate")}
        title={t("step.dismissUpdate")}
        className="relative rounded-full p-0.5 after:absolute after:-inset-1.5 after:content-[''] hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}
