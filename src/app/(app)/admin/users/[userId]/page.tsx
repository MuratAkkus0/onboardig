import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DateTime } from "@/components/common/date-time";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { AccountCard } from "@/components/org/users/account-card";
import { InvitationCard } from "@/components/org/users/invitation-card";
import { UserForm } from "@/components/org/users/user-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { idSchema } from "@/lib/validation/common";
import { requirePageRole } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { listOrgOptions } from "@/server/services/org";
import {
  getUser,
  getUserDeactivationImpact,
  listLeadCandidates,
  type UserDetail,
} from "@/server/services/users";

async function loadUser(actor: Parameters<typeof getUser>[0], id: string): Promise<UserDetail> {
  if (!idSchema.safeParse(id).success) notFound();
  try {
    return await getUser(actor, { id });
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const actor = await requirePageRole(["admin"]);
  const { userId } = await params;
  const user = await loadUser(actor, userId);
  const archived = user.onboardingStatus === "archived";
  const [t, tList, tAccount, orgOptions, leadCandidates, impact] = await Promise.all([
    getTranslations("users.form"),
    getTranslations("users.list"),
    getTranslations("users.account"),
    listOrgOptions(actor),
    listLeadCandidates(actor),
    archived
      ? Promise.resolve({ ledEmployees: [] })
      : getUserDeactivationImpact(actor, { id: userId }),
  ]);
  const tEnums = await getTranslations("enums");
  const none = tList("noValue");

  const summary = [
    { label: tList("columns.email"), value: user.email },
    { label: tList("columns.role"), value: tEnums(`role.${user.role}`) },
    {
      label: tList("columns.team"),
      value: user.teamName ? `${user.teamName} (${user.departmentName})` : none,
    },
    { label: tList("columns.jobRole"), value: user.jobRoleName ?? none },
    { label: tList("columns.lead"), value: user.leadName ?? none },
  ];

  return (
    <>
      <PageHeader
        title={t("editTitle")}
        description={user.name}
        actions={<StatusBadge kind="onboardingStatus" value={user.onboardingStatus} />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {archived ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>{tAccount("archivedBanner")}</AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>{user.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  {summary.map((row) => (
                    <div key={row.label} className="contents">
                      <dt className="text-sm text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-medium break-words">{row.value}</dd>
                    </div>
                  ))}
                  <dt className="text-sm text-muted-foreground">{tList("columns.startDate")}</dt>
                  <dd className="text-sm font-medium">
                    {user.startDate ? <DateTime value={user.startDate} variant="date" /> : none}
                  </dd>
                </dl>
              </CardContent>
            </Card>
          </div>
        ) : (
          <UserForm
            orgOptions={orgOptions}
            leadCandidates={leadCandidates}
            emailLocked={user.invitationState === "accepted"}
            initial={{
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role,
              locale: user.locale,
              teamId: user.teamId,
              jobRoleId: user.jobRoleId,
              leadId: user.leadId,
              startDate: user.startDate,
            }}
          />
        )}
        <div className="space-y-6">
          <InvitationCard userId={user.id} state={user.invitationState} canResend={!archived} />
          <AccountCard
            user={{
              id: user.id,
              name: user.name,
              archivedAt: user.archivedAt?.toISOString() ?? null,
            }}
            isSelf={user.id === actor.id}
            ledEmployees={impact.ledEmployees}
          />
        </div>
      </div>
    </>
  );
}
