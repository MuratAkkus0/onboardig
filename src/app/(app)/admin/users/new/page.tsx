import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { UserForm } from "@/components/org/users/user-form";
import { requirePageRole } from "@/server/auth/guards";
import { listOrgOptions } from "@/server/services/org";
import { listLeadCandidates } from "@/server/services/users";

export default async function NewUserPage() {
  const actor = await requirePageRole(["admin"]);
  const [t, orgOptions, leadCandidates] = await Promise.all([
    getTranslations("users.form"),
    listOrgOptions(actor),
    listLeadCandidates(actor),
  ]);
  return (
    <>
      <PageHeader title={t("createTitle")} description={t("createDescription")} />
      <div className="max-w-3xl">
        <UserForm orgOptions={orgOptions} leadCandidates={leadCandidates} />
      </div>
    </>
  );
}
