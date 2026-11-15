"use client";

import { useState, useTransition } from "react";
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
import { W1_ORG_CONFIG } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import { useActionErrorDescriber, type ActionError } from "./use-action-error";

export interface OrgNameValues {
  name: string;
  departmentId: string;
}

interface OrgNameDialogProps {
  trigger: React.ReactNode;
  title: string;
  nameLabel: string;
  initialName?: string;
  /** Adds a department select (team edit: moving a team to another department). */
  departmentField?: {
    label: string;
    options: { id: string; name: string }[];
    initialId: string;
  };
  onSubmit: (values: OrgNameValues) => Promise<ActionResult<unknown>>;
}

/** Dialog with a name field (and optionally a department select) for create and rename flows. */
export function OrgNameDialog({
  trigger,
  title,
  nameLabel,
  initialName = "",
  departmentField,
  onSubmit,
}: OrgNameDialogProps) {
  const t = useTranslations("org");
  const tCommon = useTranslations("common");
  const message = useMessage();
  const describe = useActionErrorDescriber();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [departmentId, setDepartmentId] = useState(departmentField?.initialId ?? "");
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(initialName);
      setDepartmentId(departmentField?.initialId ?? "");
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit({ name, departmentId });
      if (result.ok) {
        toast.success(t("toast.saved"));
        setOpen(false);
        return;
      }
      setError(result.error);
    });
  }

  const nameError = error?.fieldErrors?.name?.[0];
  const formError = error && !nameError ? describe(error) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {formError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                <p>{formError.text}</p>
                {formError.items.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5">
                    {formError.items.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <FormField label={nameLabel} error={nameError ? message(nameError) : undefined}>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={W1_ORG_CONFIG.nameMaxLength}
                autoComplete="off"
                required
              />
            )}
          </FormField>
          {departmentField ? (
            <FormField label={departmentField.label}>
              {(control) => (
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentField.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {tCommon("actions.cancel")}
            </Button>
            <SubmitButton pending={pending}>{tCommon("actions.save")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
