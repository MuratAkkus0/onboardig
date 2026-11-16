"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  archiveTemplateAction,
  deleteTemplateAction,
  restoreTemplateAction,
} from "@/app/(app)/admin/templates/actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useActionFeedback } from "@/components/content/action-feedback";
import { Button } from "@/components/ui/button";
import { areaRoutes, type Area } from "@/lib/area-routes";
import type { TemplateDeletionImpact } from "@/server/services/templates";

interface TemplateActionsProps {
  id: string;
  area?: Area;
  status: "active" | "archived";
  /** Loaded with the page; the service re-checks on delete. */
  impact: TemplateDeletionImpact;
}

/** Archive / restore and the delete flow of K§8: unused is deleted, used is archived after typing the name. */
export function TemplateActions({ id, status, impact, area = "admin" }: TemplateActionsProps) {
  const t = useTranslations("templates");
  const router = useRouter();
  const run = useActionFeedback();
  const [pending, startTransition] = useTransition();

  function toggleStatus() {
    startTransition(async () => {
      const archive = status === "active";
      await run(
        () => (archive ? archiveTemplateAction({ id }) : restoreTemplateAction({ id })),
        archive ? t("toast.archived") : t("toast.restored"),
      );
    });
  }

  async function remove() {
    const result = await run(() =>
      deleteTemplateAction({ id, confirmName: impact.used ? impact.name : undefined }),
    );
    if (!result.ok) return;
    if (result.data.result === "deleted") {
      toast.success(t("toast.deleted"));
      router.push(areaRoutes(area).templates);
    } else {
      toast.success(t("toast.archived"));
    }
  }

  return (
    <>
      <Button type="button" variant="outline" disabled={pending} onClick={toggleStatus}>
        {status === "active" ? (
          <Archive aria-hidden="true" />
        ) : (
          <ArchiveRestore aria-hidden="true" />
        )}
        {status === "active" ? t("status.archive") : t("status.restore")}
      </Button>
      <ConfirmDialog
        destructive
        trigger={
          <Button type="button" variant="outline">
            <Trash2 aria-hidden="true" />
            {t("delete.button")}
          </Button>
        }
        title={
          impact.used
            ? t("delete.usedTitle", { name: impact.name })
            : t("delete.unusedTitle", { name: impact.name })
        }
        description={impact.used ? t("delete.usedDescription") : t("delete.unusedDescription")}
        confirmLabel={impact.used ? t("delete.confirmUsed") : t("delete.confirmUnused")}
        requireText={impact.used ? impact.name : undefined}
        impact={
          impact.used
            ? [
                t("delete.impactAssigned", { count: impact.assignmentCount }),
                t("delete.impactActive", { count: impact.activePlanCount }),
              ]
            : undefined
        }
        onConfirm={remove}
      />
    </>
  );
}
