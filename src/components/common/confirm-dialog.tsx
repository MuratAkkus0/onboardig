"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "./form-field";

interface ConfirmDialogProps {
  /** The element that opens the dialog (rendered as the trigger). */
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** "Type the name to confirm" mode (K§8): the confirm button stays disabled until it matches. */
  requireText?: string;
  /** Impact list shown above the confirmation input. */
  impact?: string[];
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  requireText,
  impact,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = requireText === undefined || typed === requireText;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setTyped("");
  }

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      handleOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("confirm.defaultTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t("confirm.defaultDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {impact && impact.length > 0 ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">{t("confirm.impactTitle")}</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {impact.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {requireText !== undefined ? (
          <FormField
            label={t("confirm.typeToConfirmLabel")}
            description={t("confirm.typeToConfirm", { name: requireText })}
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
          <AlertDialogCancel disabled={pending}>{t("actions.cancel")}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!matches || pending}
            onClick={handleConfirm}
          >
            {confirmLabel ?? t("actions.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
