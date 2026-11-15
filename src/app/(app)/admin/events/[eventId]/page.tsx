import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { EventActions } from "@/components/events/event-actions";
import { EventForm } from "@/components/events/event-form";
import { ROUTES } from "@/config/app";
import { toBerlinLocalInput } from "@/lib/datetime";
import { idSchema } from "@/lib/validation/common";
import { requirePageRole } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getEvent } from "@/server/services/events";
import { updateEventAction } from "../actions";

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const actor = await requirePageRole(["admin"]);
  const { eventId } = await params;
  if (!idSchema.safeParse(eventId).success) notFound();
  const t = await getTranslations("events");
  const event = await getEvent(actor, { id: eventId }).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  return (
    <>
      <PageHeader
        title={t("admin.editTitle")}
        actions={<EventActions id={event.id} afterDeleteHref={ROUTES.adminEvents} />}
      />
      <EventForm
        action={updateEventAction.bind(null, event.id)}
        initial={{
          titleDe: event.titleDe,
          descriptionDe: event.descriptionDe,
          titleEn: event.titleEn ?? "",
          descriptionEn: event.descriptionEn ?? "",
          startsAt: toBerlinLocalInput(event.startsAt),
          endsAt: toBerlinLocalInput(event.endsAt),
          location: event.location ?? "",
        }}
      />
    </>
  );
}
