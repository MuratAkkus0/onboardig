"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { announceEventAction, deleteEventAction } from "@/app/(app)/admin/events/actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useMessage } from "@/components/common/use-message";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/app";

interface EventActionsProps {
  id: string;
  /** Show the edit link (list rows) or not (edit page). */
  showEdit?: boolean;
  /** Where to go after deleting; default just refreshes the current page. */
  afterDeleteHref?: string;
}

/** Edit / announce / delete for one event (admin). */
export function EventActions({ id, showEdit = false, afterDeleteHref }: EventActionsProps) {
  const t = useTranslations("events");
  const message = useMessage();
  const router = useRouter();

  async function announce() {
    const result = await announceEventAction(id);
    if (result.ok) {
      toast.success(t("announce.success", { count: result.data.recipients }));
      router.refresh();
    } else {
      toast.error(message((result.error.details?.reasonKey as string) ?? result.error.messageKey));
    }
  }

  async function remove() {
    const result = await deleteEventAction(id);
    if (!result.ok) {
      toast.error(message(result.error.messageKey));
      return;
    }
    if (afterDeleteHref) router.push(afterDeleteHref);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showEdit ? (
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.adminEvent(id)}>
            <Pencil aria-hidden="true" />
            {t("form.edit")}
          </Link>
        </Button>
      ) : null}
      <ConfirmDialog
        title={t("announce.title")}
        description={t("announce.description")}
        confirmLabel={t("announce.confirm")}
        onConfirm={announce}
        trigger={
          <Button variant="outline" size="sm">
            <Megaphone aria-hidden="true" />
            {t("announce.action")}
          </Button>
        }
      />
      <ConfirmDialog
        destructive
        title={t("delete.title")}
        description={t("delete.description")}
        confirmLabel={t("delete.confirm")}
        onConfirm={remove}
        trigger={
          <Button variant="outline" size="sm">
            <Trash2 aria-hidden="true" />
            {t("delete.action")}
          </Button>
        }
      />
    </div>
  );
}
