import { ROUTES } from "@/config/app";
import type { Role } from "@/server/auth/types";

/** Shared content/template components serve two route trees: the admin area and the lead area. */
export type Area = "admin" | "lead";

export function areaOf(role: Role): Area {
  return role === "admin" ? "admin" : "lead";
}

/** Routes of the library and template screens for the given area. */
export function areaRoutes(area: Area) {
  return area === "admin"
    ? {
        library: ROUTES.adminLibrary,
        pageEdit: ROUTES.adminPageEdit,
        templates: ROUTES.adminTemplates,
        template: ROUTES.adminTemplate,
        templateNew: ROUTES.adminTemplateNew,
      }
    : {
        library: ROUTES.library,
        pageEdit: ROUTES.pageEdit,
        templates: ROUTES.templates,
        template: ROUTES.template,
        templateNew: ROUTES.templateNew,
      };
}
