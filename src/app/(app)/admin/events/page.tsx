import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DateTime } from "@/components/common/date-time";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EventActions } from "@/components/events/event-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { requirePageRole } from "@/server/auth/guards";
import { listEvents } from "@/server/services/events";

export default async function AdminEventsPage() {
  const actor = await requirePageRole(["admin"]);
  const t = await getTranslations("events");
  const { upcoming, past } = await listEvents(actor);
  const all = [...upcoming, ...past];
  return (
    <>
      <PageHeader
        title={t("admin.title")}
        actions={
          <Button asChild>
            <Link href={ROUTES.adminEventNew}>
              <Plus aria-hidden="true" />
              {t("admin.create")}
            </Link>
          </Button>
        }
      />
      {all.length === 0 ? (
        <EmptyState title={t("admin.emptyTitle")} description={t("admin.emptyDescription")} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <caption className="sr-only">{t("admin.listLabel")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("admin.columns.title")}</TableHead>
                <TableHead scope="col">{t("admin.columns.startsAt")}</TableHead>
                <TableHead scope="col">{t("admin.columns.endsAt")}</TableHead>
                <TableHead scope="col">{t("admin.columns.announced")}</TableHead>
                <TableHead scope="col">{t("admin.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="max-w-xs font-medium break-words whitespace-normal">
                    <Link href={ROUTES.adminEvent(event.id)} className="hover:underline">
                      {event.titleDe}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DateTime value={event.startsAt} />
                  </TableCell>
                  <TableCell>
                    <DateTime value={event.endsAt} />
                  </TableCell>
                  <TableCell>
                    {event.lastAnnouncedAt ? (
                      <DateTime value={event.lastAnnouncedAt} />
                    ) : (
                      <span className="text-muted-foreground">{t("admin.notAnnounced")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <EventActions id={event.id} showEdit />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
