import type { LOCALES } from "@/config/app";
import type common from "../../messages/de/common.json";
import type enums from "../../messages/de/enums.json";
import type nav from "../../messages/de/nav.json";
import type auth from "../../messages/de/auth.json";
import type profile from "../../messages/de/profile.json";
import type errors from "../../messages/de/errors.json";
import type validation from "../../messages/de/validation.json";
import type emails from "../../messages/de/emails.json";
import type notificationItems from "../../messages/de/notificationItems.json";
import type org from "../../messages/de/org.json";
import type users from "../../messages/de/users.json";
import type library from "../../messages/de/library.json";
import type editor from "../../messages/de/editor.json";
import type notifications from "../../messages/de/notifications.json";
import type events from "../../messages/de/events.json";
import type templates from "../../messages/de/templates.json";
import type plan from "../../messages/de/plan.json";
import type dashboard from "../../messages/de/dashboard.json";
import type search from "../../messages/de/search.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof LOCALES)[number];
    Messages: {
      common: typeof common;
      enums: typeof enums;
      nav: typeof nav;
      auth: typeof auth;
      profile: typeof profile;
      errors: typeof errors;
      validation: typeof validation;
      emails: typeof emails;
      notificationItems: typeof notificationItems;
      org: typeof org;
      users: typeof users;
      library: typeof library;
      editor: typeof editor;
      notifications: typeof notifications;
      events: typeof events;
      templates: typeof templates;
      plan: typeof plan;
      dashboard: typeof dashboard;
      search: typeof search;
    };
  }
}
