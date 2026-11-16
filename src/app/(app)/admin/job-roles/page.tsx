import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AddJobRoleButton, JobRoleList } from "@/components/org/job-role-list";
import { requirePageRole } from "@/server/auth/guards";
import { listDepartments, listJobRoles } from "@/server/services/org";

export default async function AdminJobRolesPage() {
  const actor = await requirePageRole(["admin"]);
  const [t, jobRoles, departments] = await Promise.all([
    getTranslations("org.jobRoles"),
    listJobRoles(actor),
    listDepartments(actor),
  ]);
  const departmentOptions = departments.map(({ id, name }) => ({ id, name }));
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<AddJobRoleButton departments={departmentOptions} />}
      />
      {jobRoles.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <JobRoleList jobRoles={jobRoles} departments={departmentOptions} />
      )}
    </>
  );
}
