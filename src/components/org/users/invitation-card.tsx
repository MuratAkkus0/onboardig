"use client";

import { Mail } from "lucide-react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { resendInvitationAction } from "@/app/(app)/admin/users/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app";
import type { InvitationState } from "@/server/services/invitations";
import { useActionErrorDescriber } from "../use-action-error";

const BADGE_VARIANT = {
  none: "outline",
  pending: "secondary",
  expired: "destructive",
  accepted: "default",
} as const;

export function InvitationCard({
  userId,
  state,
  canResend,
}: {
  userId: string;
  state: InvitationState;
  /** False for archived users: they must be reactivated first. */
  canResend: boolean;
}) {
  const t = useTranslations("users.invitation");
  const tToast = useTranslations("users.toast");
  const describe = useActionErrorDescriber();
  const [pending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const result = await resendInvitationAction({ id: userId });
      if (!result.ok) {
        toast.error(describe(result.error).text);
        return;
      }
      if (result.data.sent) toast.success(tToast("resent"));
      else toast.error(tToast("resentFailed"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={BADGE_VARIANT[state]}>{t(`state.${state}`)}</Badge>
        <p className="text-sm text-muted-foreground">
          {t(`description.${state}`, { hours: APP_CONFIG.auth.inviteTokenTtlHours })}
        </p>
        {state !== "accepted" && canResend ? (
          <Button
            variant="outline"
            size="sm"
            onClick={resend}
            disabled={pending}
            aria-busy={pending}
          >
            <Mail aria-hidden="true" />
            {t("resend")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
