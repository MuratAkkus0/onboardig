"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useMessage } from "@/components/common/use-message";
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
import type { ActionResult } from "@/lib/action-result";
import type { OrgEntry } from "@/server/services/org";
import { useActionErrorDescriber } from "./use-action-error";

interface Usage {
  used: boolean;
  users: OrgEntry[];
  templates: OrgEntry[];
  jobRoles?: OrgEntry[];
  modules?: OrgEntry[];
  emptyTeams?: OrgEntry[];
}

type DialogState = { usage: Usage } | null;

interface DeleteEntityDialogProps {
  kind: "department" | "team" | "jobRole";
  name: string;
  /** Accessible label of the trigger button. */
  triggerLabel: string;
  loadUsage: () => Promise<ActionResult<Usage>>;
  remove: () => Promise<ActionResult>;
}

/**
 * Delete flow of K§8: the usage is loaded first. Used entries cannot be deleted, the dialog lists
 * the people and templates that block it; unused entries get a simple confirmation (a department
 * also names the empty teams that go with it).
 */
export function DeleteEntityDialog({
  kind,
  name,
  triggerLabel,
  loadUsage,
  remove,
}: DeleteEntityDialogProps) {
  const t = useTranslations("org");
  const tCommon = useTranslations("common");
  const message = useMessage();
  const describe = useActionErrorDescriber();
  const [state, setState] = useState<DialogState>(null);
  const [checking, startChecking] = useTransition();
  const [removing, startRemoving] = useTransition();

  function open() {
    startChecking(async () => {
      const result = await loadUsage();
      if (!result.ok) {
        toast.error(message(result.error.messageKey));
        return;
      }
      setState({ usage: result.data });
    });
  }

  function confirm() {
    startRemoving(async () => {
      const result = await remove();
      if (result.ok) {
        toast.success(t("toast.deleted"));
        setState(null);
        return;
      }
      toast.error(describe(result.error).text);
      setState(null);
    });
  }

  const usage = state?.usage;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={triggerLabel}
        title={triggerLabel}
        disabled={checking}
        aria-busy={checking}
        onClick={open}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      <AlertDialog open={state !== null} onOpenChange={(next) => !next && setState(null)}>
        <AlertDialogContent>
          {usage?.used ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("delete.blocked.title", { name })}</AlertDialogTitle>
                <AlertDialogDescription>{t("delete.blocked.description")}</AlertDialogDescription>
              </AlertDialogHeader>
              <UsageList heading={t("delete.blocked.users")} entries={usage.users} />
              <UsageList heading={t("delete.blocked.templates")} entries={usage.templates} />
              <UsageList heading={t("delete.blocked.jobRoles")} entries={usage.jobRoles ?? []} />
              <UsageList heading={t("delete.blocked.modules")} entries={usage.modules ?? []} />
              <AlertDialogFooter>
                <AlertDialogCancel>{t("delete.blocked.close")}</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t(`delete.${kind}.title`, { name })}</AlertDialogTitle>
                <AlertDialogDescription>{t(`delete.${kind}.description`)}</AlertDialogDescription>
              </AlertDialogHeader>
              {kind === "department" ? (
                <UsageList
                  heading={t("delete.department.teamsGoWith")}
                  entries={usage?.emptyTeams ?? []}
                />
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={removing}>
                  {tCommon("actions.cancel")}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={removing}
                  aria-busy={removing}
                  onClick={confirm}
                >
                  {t("delete.confirm")}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UsageList({ heading, entries }: { heading: string; entries: OrgEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">{heading}</p>
      <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-muted-foreground">
        {entries.map((entry) => (
          <li key={entry.id}>{entry.name}</li>
        ))}
      </ul>
    </div>
  );
}
