import Link from "next/link";
import { useTranslations } from "next-intl";
import { DateTime } from "@/components/common/date-time";
import { StatusBadge } from "@/components/common/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import type { UserListItem } from "@/server/services/users";

/** Responsive list: secondary columns drop out on narrow screens, the name cell carries the e-mail. */
export function UserTable({ users }: { users: UserListItem[] }) {
  const t = useTranslations("users.list");
  const tEnums = useTranslations("enums");
  const empty = t("noValue");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columns.name")}</TableHead>
          <TableHead className="hidden sm:table-cell">{t("columns.role")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("columns.team")}</TableHead>
          <TableHead className="hidden xl:table-cell">{t("columns.jobRole")}</TableHead>
          <TableHead className="hidden xl:table-cell">{t("columns.lead")}</TableHead>
          <TableHead className="hidden lg:table-cell">{t("columns.startDate")}</TableHead>
          <TableHead>{t("columns.status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="whitespace-normal">
              <Link
                href={ROUTES.adminUser(user.id)}
                className="font-medium break-words underline-offset-4 hover:underline"
              >
                {user.name}
              </Link>
              <p className="text-sm break-all text-muted-foreground">{user.email}</p>
            </TableCell>
            <TableCell className="hidden sm:table-cell">{tEnums(`role.${user.role}`)}</TableCell>
            <TableCell className="hidden whitespace-normal md:table-cell">
              {user.teamName ? (
                <>
                  <span>{user.teamName}</span>
                  <p className="text-sm text-muted-foreground">{user.departmentName}</p>
                </>
              ) : (
                empty
              )}
            </TableCell>
            <TableCell className="hidden whitespace-normal xl:table-cell">
              {user.jobRoleName ?? empty}
            </TableCell>
            <TableCell className="hidden whitespace-normal xl:table-cell">
              {user.leadName ?? empty}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              {user.startDate ? <DateTime value={user.startDate} variant="date" /> : empty}
            </TableCell>
            <TableCell>
              <StatusBadge kind="onboardingStatus" value={user.onboardingStatus} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
