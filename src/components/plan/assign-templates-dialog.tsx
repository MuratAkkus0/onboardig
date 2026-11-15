"use client";

import { useState, useTransition } from "react";
import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { assignTemplatesAction } from "@/app/(app)/team/[userId]/actions";
import { useMessage } from "@/components/common/use-message";
import { SubmitButton } from "@/components/common/submit-button";
import { failureKey } from "@/components/content/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { AssignableTemplate } from "@/server/services/plans";

interface AssignTemplatesDialogProps {
  userId: string;
  templates: AssignableTemplate[];
}

/** Multi-select of active templates; the ones matching department, team and role are pre-checked. */
export function AssignTemplatesDialog({ userId, templates }: AssignTemplatesDialogProps) {
  const t = useTranslations("plan.assign");
  const message = useMessage();
  const initial = () => new Set(templates.filter((tpl) => tpl.suggested).map((tpl) => tpl.id));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected(initial());
      setError(undefined);
    }
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.size === 0) {
      setError(t("noneSelected"));
      return;
    }
    startTransition(async () => {
      const result = await assignTemplatesAction(userId, [...selected]);
      if (result.ok) {
        toast.success(t("success", { count: result.data.addedSteps }));
        setOpen(false);
      } else {
        setError(message(failureKey(result.error)));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <Layers aria-hidden="true" />
          {t("action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-y-auto">
              {templates.map((template) => {
                const id = `assign-${template.id}`;
                const { department, team, jobRole } = template.scope;
                return (
                  <li key={template.id} className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      checked={selected.has(template.id)}
                      onCheckedChange={(checked) => toggle(template.id, checked === true)}
                    />
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor={id} className="break-words">
                        {template.name}
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {department === null && team === null && jobRole === null ? (
                          <Badge variant="outline">{t("scopeAll")}</Badge>
                        ) : null}
                        {department ? (
                          <Badge variant="outline">
                            {t("scopeDepartment", { name: department })}
                          </Badge>
                        ) : null}
                        {team ? (
                          <Badge variant="outline">{t("scopeTeam", { name: team })}</Badge>
                        ) : null}
                        {jobRole ? (
                          <Badge variant="outline">{t("scopeJobRole", { name: jobRole })}</Badge>
                        ) : null}
                        {template.suggested ? <Badge>{t("suggested")}</Badge> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <SubmitButton pending={pending} disabled={templates.length === 0}>
              {t("submit")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
