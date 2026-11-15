import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  text,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createdAt, primaryUuid, timestamptz, updatedAt } from "./custom-types";
import { localeEnum, onboardingStatusEnum, themeEnum, userRoleEnum } from "./enums";
import { jobRoles, teams } from "./org";

export const users = pgTable(
  "users",
  {
    id: primaryUuid(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    role: userRoleEnum("role").notNull().default("employee"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamptz("ban_expires"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    jobRoleId: uuid("job_role_id").references(() => jobRoles.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references((): AnyPgColumn => users.id, { onDelete: "restrict" }),
    startDate: date("start_date", { mode: "string" }),
    locale: localeEnum("locale").notNull().default("de"),
    theme: themeEnum("theme").notNull().default("system"),
    onboardingStatus: onboardingStatusEnum("onboarding_status").notNull().default("active"),
    onboardingCompletedAt: timestamptz("onboarding_completed_at"),
    archivedAt: timestamptz("archived_at"),
  },
  (t) => [
    unique("users_email_uq").on(t.email),
    check("users_lead_not_self_ck", sql`${t.leadId} IS NULL OR ${t.leadId} <> ${t.id}`),
    index("users_lead_id_idx").on(t.leadId),
    index("users_team_id_idx").on(t.teamId),
    index("users_job_role_id_idx").on(t.jobRoleId),
    index("users_onboarding_status_idx").on(t.onboardingStatus),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: primaryUuid(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [unique("sessions_token_uq").on(t.token), index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: primaryUuid(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("accounts_provider_account_uq").on(t.providerId, t.accountId),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: primaryUuid(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);
