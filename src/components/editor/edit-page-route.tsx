import { notFound, redirect } from "next/navigation";
import { ZodError } from "zod";
import { ROUTES } from "@/config/app";
import type { Area } from "@/lib/area-routes";
import { requirePageRole } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getPageForEdit } from "@/server/services/pages";
import { PageEditor } from "./page-editor";
import type { EditablePage } from "./types";

/**
 * Body of the page-edit routes: /admin/library/pages/[id]/edit and /library/pages/[id]/edit.
 * The service decides who may edit; a page the viewer cannot see (or a malformed id) is a 404.
 */
export async function EditPageRoute({ pageId, area }: { pageId: string; area: Area }) {
  const actor = await requirePageRole(area === "admin" ? ["admin"] : ["team_lead", "admin"]);
  // Admins have their own editor route; the lead route is only for team leads.
  if (area === "lead" && actor.role === "admin") redirect(ROUTES.adminPageEdit(pageId));
  let editable: EditablePage;
  try {
    const page = await getPageForEdit(actor, { id: pageId });
    editable = {
      id: page.id,
      moduleTitle: page.moduleTitle,
      status: page.status,
      titleDe: page.titleDe,
      titleEn: page.titleEn,
      contentDe: page.contentDe as EditablePage["contentDe"],
      contentEn: page.contentEn as EditablePage["contentEn"],
      lastEditedAt: page.lastEditedAt.toISOString(),
      lastEditedByName: page.lastEditedByName,
    };
  } catch (e) {
    // A page the actor may not edit is answered like a missing one (as on every other guarded route).
    if (
      (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) ||
      e instanceof ZodError
    )
      notFound();
    throw e;
  }
  return <PageEditor page={editable} area={area} />;
}
