import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AddDepartmentButton, DepartmentList } from "@/components/org/department-list";
import { requirePageRole } from "@/server/auth/guards";
import { listDepartments } from "@/server/services/org";

export default async function AdminOrgPage() {
  const actor = await requirePageRole(["admin"]);
  const [t, departments] = await Promise.all([
    getTranslations("org.departments"),
    listDepartments(actor),
  ]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<AddDepartmentButton />}
      />
      {departments.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <DepartmentList departments={departments} />
      )}
    </>
  );
}
