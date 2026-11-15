"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  deactivateUserAction,
  deleteUserPermanentlyAction,
  reactivateUserAction,
} from "@/app/(app)/admin/users/actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DateTime } from "@/components/common/date-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_CONFIG, ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import { useActionErrorDescriber } from "../use-action-error";

interface AccountCardProps {
  user: { id: string; name: string; archivedAt: string | null };
  isSelf: boolean;
  /** People that still have this user as lead (deactivation warning). */
  ledEmployees: { id: string; name: string }[];
}

export function AccountCard({ user, isSelf, ledEmployees }: AccountCardProps) {
  const t = useTranslations("users.account");
  const tToast = useTranslations("users.toast");
  const router = useRouter();
  const describe = useActionErrorDescriber();
  const archived = user.archivedAt !== null;

  async function run(
    action: () => Promise<ActionResult>,
    successKey: Parameters<typeof tToast>[0],
  ) {
    const result = await action();
    if (!result.ok) {
      const { text, items } = describe(result.error);
      toast.error([text, ...items].join(" "));
      return false;
    }
    toast.success(tToast(successKey));
    return true;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {archived && user.archivedAt ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("archivedSince")} <DateTime value={user.archivedAt} />
            </p>
            <p className="text-sm text-muted-foreground">
              {t("deletionSuggestion", { months: APP_CONFIG.archivedUserDeletionSuggestionMonths })}
            </p>
            <div className="flex flex-wrap gap-2">
              <ConfirmDialog
                title={t("reactivate.title", { name: user.name })}
                description={t("reactivate.description")}
                confirmLabel={t("reactivate.confirm")}
                onConfirm={async () => {
                  await run(() => reactivateUserAction({ id: user.id }), "reactivated");
                }}
                trigger={<Button variant="outline">{t("reactivate.button")}</Button>}
              />
              <ConfirmDialog
                title={t("delete.title", { name: user.name })}
                description={t("delete.description")}
                confirmLabel={t("delete.confirm")}
                destructive
                requireText={user.name}
                onConfirm={async () => {
                  const done = await run(
                    () => deleteUserPermanentlyAction({ id: user.id, confirmName: user.name }),
                    "deleted",
                  );
                  if (done) router.push(ROUTES.adminUsers);
                }}
                trigger={<Button variant="destructive">{t("delete.button")}</Button>}
              />
            </div>
          </>
        ) : isSelf ? (
          <p className="text-sm text-muted-foreground">{t("self")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("deactivate.description")}</p>
            <ConfirmDialog
              title={t("deactivate.title", { name: user.name })}
              description={
                ledEmployees.length > 0 ? t("deactivate.helper") : t("deactivate.description")
              }
              confirmLabel={t("deactivate.confirm")}
              destructive
              requireText={ledEmployees.length > 0 ? user.name : undefined}
              impact={ledEmployees.map((employee) =>
                t("deactivate.ledEmployee", { name: employee.name }),
              )}
              onConfirm={async () => {
                await run(() => deactivateUserAction({ id: user.id }), "deactivated");
              }}
              trigger={<Button variant="destructive">{t("deactivate.button")}</Button>}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
