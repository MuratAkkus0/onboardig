"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { W1_CONTENT_CONFIG, W1_ORG_CONFIG } from "@/config/app";
import { createModuleAction, updateModuleAction } from "@/app/(app)/admin/library/actions";
import { useActionFeedback } from "./action-feedback";

interface ModuleDialogProps {
  trigger: React.ReactNode;
  /** Set to rename an existing module; omit to create one. */
  module?: { id: string; titleDe: string; titleEn: string | null; departmentId?: string | null };
  /**
   * Departments an admin may assign. Omit for leads: their modules always belong to their own
   * department, so no select is shown and no department is sent.
   */
  departments?: { id: string; name: string }[];
}

export function ModuleDialog({ trigger, module, departments }: ModuleDialogProps) {
  const t = useTranslations("library");
  const common = useTranslations("common");
  const message = useMessage();
  const run = useActionFeedback();
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const noneValue = W1_ORG_CONFIG.noneValue;
  const [departmentId, setDepartmentId] = useState(module?.departmentId ?? noneValue);
  const title = module ? t("module.renameTitle") : t("module.createTitle");

  function submit(formData: FormData) {
    const input = {
      titleDe: String(formData.get("titleDe") ?? ""),
      titleEn: String(formData.get("titleEn") ?? ""),
      // Only admins get the select; for them "none" means company-wide.
      ...(departments ? { departmentId: departmentId === noneValue ? null : departmentId } : {}),
    };
    startTransition(async () => {
      const result = await run(
        () =>
          module ? updateModuleAction({ id: module.id, ...input }) : createModuleAction(input),
        module ? t("toast.moduleSaved") : t("toast.moduleCreated"),
      );
      if (result.ok) {
        setOpen(false);
        setFieldErrors({});
        if (!module) setDepartmentId(noneValue);
      } else {
        setFieldErrors(result.error.fieldErrors ?? {});
      }
    });
  }

  const error = (field: string) => {
    const key = fieldErrors[field]?.[0];
    return key ? message(key) : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          <FormField label={t("module.titleDe")} error={error("titleDe")}>
            {(control) => (
              <Input
                {...control}
                name="titleDe"
                defaultValue={module?.titleDe ?? ""}
                maxLength={W1_CONTENT_CONFIG.titleMaxLength}
                required
              />
            )}
          </FormField>
          <FormField label={t("module.titleEn")} error={error("titleEn")}>
            {(control) => (
              <Input
                {...control}
                name="titleEn"
                defaultValue={module?.titleEn ?? ""}
                maxLength={W1_CONTENT_CONFIG.titleMaxLength}
              />
            )}
          </FormField>
          {!departments && !module ? (
            <p className="text-sm text-muted-foreground">{t("module.ownDepartmentHint")}</p>
          ) : null}
          {departments ? (
            <FormField
              label={t("module.department")}
              error={error("departmentId")}
              description={t("module.departmentHint")}
            >
              {(control) => (
                <Select name="departmentId" value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noneValue}>{t("module.departmentNone")}</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {common("actions.cancel")}
            </Button>
            <SubmitButton pending={pending}>
              {module ? t("module.save") : t("module.create")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
