export const ROLES = ["admin", "team_lead", "employee"] as const;
export const ONBOARDING_STATUSES = ["active", "completed", "archived"] as const;
export const LOCALES = ["de", "en"] as const;
export const THEMES = ["light", "dark", "system"] as const;
export const PAGE_STATUSES = ["draft", "published", "archived"] as const;
export const TEMPLATE_STATUSES = ["active", "archived"] as const;
export const PHASES = ["before_start", "first_day", "first_week", "first_month"] as const;
export const NOTIFICATION_TYPES = [
  "step_added",
  "page_updated",
  "event_announced",
  "employee_assigned",
  "onboarding_completed",
] as const;

export const APP_CONFIG = {
  appName: "Onboarding Portal",
  logoPath: "/logo.svg",
  auth: {
    passwordMinLength: 12,
    passwordMaxLength: 128,
    sessionExpiresInSeconds: 7 * 24 * 60 * 60,
    sessionUpdateAgeSeconds: 24 * 60 * 60,
    inviteTokenTtlHours: 72,
    resetPasswordTokenTtlSeconds: 60 * 60,
    rateLimit: {
      windowSeconds: 60,
      max: 100,
      signInMax: 5,
      passwordResetMax: 3,
    },
    disabledPaths: [
      "/admin/create-user",
      "/admin/update-user",
      "/admin/remove-user",
      "/admin/set-role",
      "/admin/set-user-password",
      "/admin/ban-user",
      "/admin/unban-user",
      "/admin/impersonate-user",
      "/admin/stop-impersonating",
      "/admin/list-users",
      "/admin/get-user",
      "/admin/list-user-sessions",
      "/admin/revoke-user-session",
      "/admin/revoke-user-sessions",
      "/admin/has-permission",
      "/update-user",
      "/delete-user",
      "/delete-user/callback",
      "/change-email",
      "/link-social",
      "/unlink-account",
      "/send-verification-email",
      "/verify-email",
      "/sign-up/email",
      "/sign-in/social",
      "/refresh-token",
      "/get-access-token",
    ],
  },
  i18n: {
    locales: LOCALES,
    defaultLocale: "de",
    localeCookie: "NEXT_LOCALE",
    timeZone: "Europe/Berlin",
  },
  theme: { values: THEMES, default: "system" },
  notifications: { pollIntervalMs: 60_000, retentionDays: 90, bellPreviewLimit: 8, pageSize: 20 },
  locks: {
    heartbeatIntervalMs: 30_000,
    leaseDurationSeconds: 120,
    idleTimeoutMs: 15 * 60_000,
    idlePromptGraceMs: 60_000,
  },
  uploads: {
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    maxBytes: 5 * 1024 * 1024,
    urlPrefix: "/api/uploads/",
  },
  search: { minQueryLength: 2, maxResults: 20 },
  archivedUserDeletionSuggestionMonths: 6,
  draftStorageKeyPrefix: "onboarding-portal:page-draft:",
} as const;

export const ROUTES = {
  login: "/login",
  setPassword: "/set-password",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  home: "/",
  plan: "/plan",
  page: (id: string) => `/pages/${id}`,
  events: "/events",
  search: "/search",
  notifications: "/notifications",
  profile: "/profile",
  team: "/team",
  teamMember: (id: string) => `/team/${id}`,
  library: "/library",
  admin: "/admin",
  adminUsers: "/admin/users",
  adminUser: (id: string) => `/admin/users/${id}`,
  adminUserNew: "/admin/users/new",
  adminOrg: "/admin/org",
  adminJobRoles: "/admin/job-roles",
  adminLibrary: "/admin/library",
  adminPageEdit: (id: string) => `/admin/library/pages/${id}/edit`,
  adminTemplates: "/admin/templates",
  adminTemplate: (id: string) => `/admin/templates/${id}`,
  adminTemplateNew: "/admin/templates/new",
  adminEvents: "/admin/events",
  adminEvent: (id: string) => `/admin/events/${id}`,
  adminEventNew: "/admin/events/new",
} as const;

export const ROUTE_ACCESS = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/team", roles: ["team_lead", "admin"] },
  { prefix: "/library", roles: ["team_lead", "admin"] },
] as const;

export const NAVIGATION = [
  {
    key: "plan",
    href: ROUTES.plan,
    icon: "list-checks",
    roles: ["employee", "team_lead", "admin"],
  },
  {
    key: "events",
    href: ROUTES.events,
    icon: "calendar-days",
    roles: ["employee", "team_lead", "admin"],
  },
  {
    key: "search",
    href: ROUTES.search,
    icon: "search",
    roles: ["employee", "team_lead", "admin"],
  },
  { key: "team", href: ROUTES.team, icon: "users", roles: ["team_lead", "admin"] },
  { key: "library", href: ROUTES.library, icon: "book-open", roles: ["team_lead"] },
  {
    key: "adminOverview",
    href: ROUTES.admin,
    icon: "layout-dashboard",
    roles: ["admin"],
    section: "admin",
  },
  {
    key: "adminUsers",
    href: ROUTES.adminUsers,
    icon: "user-cog",
    roles: ["admin"],
    section: "admin",
  },
  {
    key: "adminOrg",
    href: ROUTES.adminOrg,
    icon: "building-2",
    roles: ["admin"],
    section: "admin",
  },
  {
    key: "adminJobRoles",
    href: ROUTES.adminJobRoles,
    icon: "briefcase",
    roles: ["admin"],
    section: "admin",
  },
  {
    key: "adminLibrary",
    href: ROUTES.adminLibrary,
    icon: "library",
    roles: ["admin"],
    section: "admin",
  },
  {
    key: "adminTemplates",
    href: ROUTES.adminTemplates,
    icon: "layers",
    roles: ["admin"],
    section: "admin",
  },
  {
    key: "adminEvents",
    href: ROUTES.adminEvents,
    icon: "calendar-cog",
    roles: ["admin"],
    section: "admin",
  },
] as const;

// ---- unit-owned sections: edit ONLY strictly between your own >>> / <<< markers ----

// >>> F2a (owned by F2a)
export const F2A_CONFIG = {} as const;
// <<< F2a

// >>> F2b (owned by F2b)
export const F2B_CONFIG = {} as const;
// <<< F2b

// >>> W1-org (owned by W1-org)
export const W1_ORG_CONFIG = {} as const;
// <<< W1-org

// >>> W1-content (owned by W1-content)
export const W1_CONTENT_CONFIG = {} as const;
// <<< W1-content

// >>> W1-notify-events (owned by W1-notify-events)
export const W1_NOTIFY_EVENTS_CONFIG = {} as const;
// <<< W1-notify-events

// >>> W2-templates (owned by W2-templates)
export const W2_TEMPLATES_CONFIG = {} as const;
// <<< W2-templates

// >>> W2-plans (owned by W2-plans)
export const W2_PLANS_CONFIG = {} as const;
// <<< W2-plans

// >>> W3-dashboards (owned by W3-dashboards)
export const W3_DASHBOARDS_CONFIG = {} as const;
// <<< W3-dashboards

// >>> W3-search (owned by W3-search)
export const W3_SEARCH_CONFIG = {} as const;
// <<< W3-search

// >>> W3-delivery (owned by W3-delivery)
export const W3_DELIVERY_CONFIG = {} as const;
// <<< W3-delivery
