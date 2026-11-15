import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { UserFilters } from "@/components/org/users/user-filters";
import { UserTable } from "@/components/org/users/user-table";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STATUSES, ROLES, ROUTES, W1_ORG_CONFIG } from "@/config/app";
import { idSchema } from "@/lib/validation/common";
import type { ListUsersInput } from "@/lib/validation/users";
import { requirePageRole } from "@/server/auth/guards";
import { listOrgOptions } from "@/server/services/org";
import { listUsers } from "@/server/services/users";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first && first !== W1_ORG_CONFIG.allValue ? first : "";
}

function pick<T extends string>(allowed: readonly T[], value: string): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function pickId(value: string): string | undefined {
  return idSchema.safeParse(value).success ? value : undefined;
}

/** Reads the filter values from the URL; anything invalid is treated as "no filter". */
function readFilters(params: SearchParams): ListUsersInput {
  return {
    q: single(params, "q") || undefined,
    status: pick(ONBOARDING_STATUSES, single(params, "status")),
    role: pick(ROLES, single(params, "role")),
    departmentId: pickId(single(params, "departmentId")),
    teamId: pickId(single(params, "teamId")),
  };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requirePageRole(["admin"]);
  const filters = readFilters(await searchParams);
  const [t, orgOptions, users] = await Promise.all([
    getTranslations("users.list"),
    listOrgOptions(actor),
    listUsers(actor, filters),
  ]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href={ROUTES.adminUserNew}>
              <Plus aria-hidden="true" />
              {t("add")}
            </Link>
          </Button>
        }
      />
      <UserFilters
        values={{
          q: filters.q ?? "",
          status: filters.status ?? "",
          role: filters.role ?? "",
          departmentId: filters.departmentId ?? "",
          teamId: filters.teamId ?? "",
        }}
        orgOptions={orgOptions}
      />
      {users.length === 0 ? (
        <EmptyState
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredDescription") : t("empty.description")}
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {t("count", { count: users.length })}
          </p>
          <UserTable users={users} />
        </>
      )}
    </>
  );
}
