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
  "feedback_resolved",
] as const;
export const FEEDBACK_TYPES = ["app_bug", "content_issue", "other"] as const;
export const FEEDBACK_STATUSES = ["open", "in_progress", "done"] as const;

export const APP_CONFIG = {
  appName: "Startklar",
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
  draftStorageKeyPrefix: "startklar:page-draft:",
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
  pageEdit: (id: string) => `/library/pages/${id}/edit`,
  templates: "/templates",
  template: (id: string) => `/templates/${id}`,
  templateNew: "/templates/new",
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
  reports: "/reports",
  adminReports: "/admin/reports",
} as const;

/** Where the page view's "Back" leads when the page was opened directly (no in-app history). */
export const PAGE_BACK_FALLBACK = {
  employee: ROUTES.plan,
  team_lead: ROUTES.library,
  admin: ROUTES.adminLibrary,
} as const;

export const ROUTE_ACCESS = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/team", roles: ["team_lead", "admin"] },
  { prefix: "/library", roles: ["team_lead", "admin"] },
  { prefix: "/templates", roles: ["team_lead", "admin"] },
  { prefix: "/reports", roles: ["team_lead", "admin"] },
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
  {
    key: "reports",
    href: ROUTES.reports,
    icon: "message-square-warning",
    roles: ["team_lead"],
  },
  { key: "library", href: ROUTES.library, icon: "book-open", roles: ["team_lead"] },
  { key: "templates", href: ROUTES.templates, icon: "layers", roles: ["team_lead"] },
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
  {
    key: "adminReports",
    href: ROUTES.adminReports,
    icon: "message-square-warning",
    roles: ["admin"],
    section: "admin",
  },
] as const;

// ---- unit-owned sections: edit ONLY strictly between your own >>> / <<< markers ----

// >>> F2a (owned by F2a)
export const F2A_CONFIG = {
  invitations: { tokenBytes: 32 },
  notifications: { maxPageSize: 100 },
  http: {
    // Methods that never need the Origin check in route handlers (they must not mutate).
    safeMethods: ["GET", "HEAD", "OPTIONS"],
    statusByErrorCode: {
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      VALIDATION: 400,
      CONFLICT: 409,
      IN_USE: 409,
      INVALID_TRANSITION: 409,
      LOCK_HELD: 423,
      LOCK_LOST: 423,
      INVITE_INVALID: 400,
      INVITE_EXPIRED: 400,
      LAST_ADMIN: 409,
      FILE_TOO_LARGE: 413,
      FILE_TYPE_NOT_ALLOWED: 415,
      EMAIL_TAKEN: 409,
      RATE_LIMITED: 429,
      INTERNAL: 500,
    },
  },
} as const;
// <<< F2a

// >>> F2b (owned by F2b)
export const F2B_CONFIG = {
  queryParams: { next: "next", reason: "reason", token: "token", error: "error" },
  sessionEndedReason: "session-ended",
  // Better Auth error codes mapped to message keys by the login form.
  signInErrorCodes: { banned: "BANNED_USER", rateLimitedStatus: 429 },
  // Marker for an in-app redirect target ("/x"); anything else is ignored (open-redirect guard).
  safePathPrefix: "/",
  dateTime: { localInputFormat: "yyyy-MM-dd'T'HH:mm" },
  avatarInitialsLength: 2,
  localeCookieMaxAgeSeconds: 365 * 24 * 60 * 60,
} as const;
// <<< F2b

// >>> W1-org (owned by W1-org)
export const W1_ORG_CONFIG = {
  nameMaxLength: 100,
  personNameMaxLength: 100,
  emailMaxLength: 254,
  searchMaxLength: 100,
  // Select value that stands for "no selection" / "no filter" (Radix Select items cannot be "").
  noneValue: "none",
  allValue: "all",
} as const;
// <<< W1-org

// >>> W1-content (owned by W1-content)
export const W1_CONTENT_CONFIG = {
  titleMaxLength: 200,
  // H1 is the page title itself, so the editor offers H2 and H3 only.
  headingLevels: [2, 3],
  allowedLinkProtocols: ["http:", "https:", "mailto:"],
  maxDocumentBytes: 2 * 1024 * 1024,
  imageExtensions: {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  },
  maxUploadNameLength: 120,
  imageCacheControl: "private, max-age=3600",
  // Advisory lock key serialising sort_order assignment for new modules.
  moduleSortLockKey: 7_301_001,
  // SQLSTATE of a violated ON DELETE RESTRICT foreign key (23503 is only used for NO ACTION).
  restrictViolationCode: "23001",
} as const;
// <<< W1-content

// >>> W1-notify-events (owned by W1-notify-events)
export const W1_NOTIFY_EVENTS_CONFIG = {
  notifications: {
    pollPath: "/api/notifications/poll",
    changedEvent: "notifications:changed",
    badgeMaxCount: 9,
  },
  events: {
    pastLimit: 100,
    titleMaxLength: 200,
    descriptionMaxLength: 5000,
    locationMaxLength: 200,
  },
} as const;
// <<< W1-notify-events

// >>> W2-templates (owned by W2-templates)
export const W2_TEMPLATES_CONFIG = {
  nameMaxLength: 120,
  descriptionMaxLength: 1000,
} as const;
// <<< W2-templates

// >>> W2-plans (owned by W2-plans)
export const W2_PLANS_CONFIG = {} as const;
// <<< W2-plans

// >>> W3-dashboards (owned by W3-dashboards)
export const W3_DASHBOARDS_CONFIG = {} as const;
// <<< W3-dashboards

// >>> W3-search (owned by W3-search)
export const W3_SEARCH_CONFIG = {
  queryMaxLength: 100,
  /** ts_headline control-character delimiters (never present in rendered text). */
  headline: {
    startSel: "\u0002",
    stopSel: "\u0003",
    fragmentDelimiter: "\u0001",
    minWords: 10,
    maxWords: 25,
    maxFragments: 2,
  },
} as const;
// <<< W3-search

// >>> W3-delivery (owned by W3-delivery)
export const W3_DELIVERY_CONFIG = {} as const;
// <<< W3-delivery

// >>> v-fb
export const V_FB_CONFIG = {
  maxReportsPerHour: 5,
  retentionDays: 180,
  subjectMaxLength: 120,
  messageMaxLength: 2000,
  pathMaxLength: 500,
  responseMaxLength: 1000,
  /** Rolling window of the per-reporter rate limit. */
  rateLimitWindowMinutes: 60,
  /** Prefix of the advisory lock key that serialises one reporter's concurrent submissions. */
  rateLimitLockNamespace: "feedback_report",
  /** Open-count badges on the navigation show "99+" above this value. */
  badgeMax: 99,
  /** Query parameter names of the report list filters. */
  filterParams: { status: "status", type: "type" },
  /** Select value standing for "no filter" (Radix Select forbids empty values). */
  filterAll: "all",
} as const;
// <<< v-fb

// >>> v-land
/** Public landing page at "/" (signed-out visitors only). All demo content is fictional. */
export const LANDING_CONFIG = {
  /** Internal tool: keep the landing page out of search engines by default. */
  robotsIndex: false,
  sectionIds: {
    main: "main",
    plan: "plan",
    roles: "roles",
    howItWorks: "how-it-works",
    privacy: "privacy",
  },
  /** Heading ids the sections point to with aria-labelledby. */
  headingIds: {
    hero: "hero-title",
    facts: "facts-title",
    phases: "phases-title",
    roles: "roles-title",
    howItWorks: "how-title",
    privacy: "privacy-title",
    cta: "cta-title",
  },
  /** Shown on the page as a fact. Must stay literally true: never add analytics. */
  trackingServiceCount: 0,
  demo: {
    person: "mira",
    planSteps: [
      { key: "welcome", phase: "first_day", state: "done", doneOn: "2026-11-02" },
      { key: "workplace", phase: "first_day", state: "animated", doneOn: "2026-11-03" },
      { key: "security", phase: "first_day", state: "done", updated: true, doneOn: "2026-11-02" },
      { key: "tools", phase: "first_week", state: "open" },
      { key: "contacts", phase: "first_week", state: "open" },
    ],
    phaseChips: {
      before_start: [
        { key: "documents", done: true },
        { key: "arrival", done: true },
      ],
      first_day: [
        { key: "welcome", done: true },
        { key: "workplace", done: true },
        { key: "security", done: true },
      ],
      first_week: [
        { key: "tools", done: false },
        { key: "contacts", done: false },
      ],
      first_month: [
        { key: "project", done: false },
        { key: "feedback", done: false },
      ],
    },
    team: [
      { key: "mira", percent: 60, status: "active" },
      { key: "jonas", percent: 45, status: "active" },
      { key: "lea", percent: 100, status: "completed" },
      { key: "deniz", percent: 0, status: "active" },
    ],
    /** People shown in the team-lead mini mock (subset of `team`). */
    teamPreview: ["mira", "jonas", "lea"],
    event: { startsAt: "2026-11-20T09:00:00+01:00" },
    /** Editor holding the lock: a fictional admin, not one of the new hires in `team`. */
    lock: { person: "nina", since: "2026-11-16T10:42:00+01:00" },
  },
  ring: { sizePx: 72, mobileSizePx: 56, strokePx: 8 },
  motion: {
    staggerMs: 80,
    stageDurationMs: 800,
    underlineDelayMs: 500,
    underlineMs: 700,
    checkDelayMs: 1600,
    checkMs: 300,
    ringMs: 900,
    notificationDelayMs: 2200,
    notificationRiseMs: 600,
    floatMs: 6000,
    floatIterations: 2,
    cardStaggerMs: 100,
  },
} as const;
// <<< v-land
