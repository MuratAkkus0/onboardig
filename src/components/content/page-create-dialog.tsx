"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
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
import { W1_CONTENT_CONFIG } from "@/config/app";
import { areaRoutes, type Area } from "@/lib/area-routes";
import { createPageAction } from "@/app/(app)/admin/library/actions";
import { useActionFeedback } from "./action-feedback";

/** Creates an empty draft page in the module and continues in the editor. */
export function PageCreateDialog({
  moduleId,
  trigger,
  area = "admin",
}: {
  moduleId: string;
  trigger: React.ReactNode;
  area?: Area;
}) {
  const t = useTranslations("library");
  const common = useTranslations("common");
  const message = useMessage();
  const run = useActionFeedback();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const titleDe = String(formData.get("titleDe") ?? "");
    startTransition(async () => {
      const result = await run(() => createPageAction({ moduleId, titleDe }));
      if (result.ok) {
        setOpen(false);
        router.push(areaRoutes(area).pageEdit(result.data.id));
      } else {
        const key = result.error.fieldErrors?.titleDe?.[0];
        setFieldError(key ? message(key) : undefined);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("page.createTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("page.createTitle")}</DialogDescription>
          </DialogHeader>
          <FormField label={t("page.titleLabel")} error={fieldError}>
            {(control) => (
              <Input
                {...control}
                name="titleDe"
                maxLength={W1_CONTENT_CONFIG.titleMaxLength}
                required
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {common("actions.cancel")}
            </Button>
            <SubmitButton pending={pending}>{t("page.create")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
