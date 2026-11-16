import { pgEnum } from "drizzle-orm/pg-core";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  LOCALES,
  NOTIFICATION_TYPES,
  ONBOARDING_STATUSES,
  PAGE_STATUSES,
  PHASES,
  ROLES,
  TEMPLATE_STATUSES,
  THEMES,
} from "../../../config/app";

export const userRoleEnum = pgEnum("user_role", ROLES);
export const onboardingStatusEnum = pgEnum("onboarding_status", ONBOARDING_STATUSES);
export const localeEnum = pgEnum("locale", LOCALES);
export const themeEnum = pgEnum("theme", THEMES);
export const pageStatusEnum = pgEnum("page_status", PAGE_STATUSES);
export const templateStatusEnum = pgEnum("template_status", TEMPLATE_STATUSES);
export const phaseEnum = pgEnum("phase", PHASES);
export const notificationTypeEnum = pgEnum("notification_type", NOTIFICATION_TYPES);
export const feedbackTypeEnum = pgEnum("feedback_type", FEEDBACK_TYPES);
export const feedbackStatusEnum = pgEnum("feedback_status", FEEDBACK_STATUSES);
