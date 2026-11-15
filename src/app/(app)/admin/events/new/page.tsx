import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { EventForm } from "@/components/events/event-form";
import { requirePageRole } from "@/server/auth/guards";
import { createEventAction } from "../actions";

export default async function NewEventPage() {
  await requirePageRole(["admin"]);
  const t = await getTranslations("events");
  return (
    <>
      <PageHeader title={t("admin.newTitle")} />
      <EventForm action={createEventAction} />
    </>
  );
}
