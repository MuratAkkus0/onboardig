# Onboarding Portal — v1 Architecture Blueprint

Status: binding implementation contract for v1. Source of truth for product decisions remains
[kararlar.md](kararlar.md); this document turns those decisions into a concrete technical contract so several engineers
can work **in parallel in separate git worktrees without touching the same files**.

- If this blueprint and `kararlar.md` disagree, `kararlar.md` wins; fix this document.
- If you must deviate from this blueprint, update it **in the same commit** and say why in the commit body of your
  handoff report (commit title stays one line).
- Deferred features ([v2-yapilacaklar.md](v2-yapilacaklar.md)) are **not** built. Where v1 leaves a hook for them, it is
  named explicitly below (StorageAdapter, `notifications.type` enum, Better Auth plugin list).
- Section references like "K§3" mean `kararlar.md` section 3.

Contents

1. Conventions and global rules
2. Data model (Drizzle)
3. State machines
4. Service layer
5. Server actions, route handlers, polling, image serving
6. Route map and navigation
7. i18n layout
8. Testing infrastructure
9. Env and configuration
10. Dependencies
11. Foundation (F1, F2a, F2b)
12. Work breakdown after the foundation (waves, file ownership)
13. Merge and coordination rules
14. Proposed `kararlar.md` §13 entries and review notes

---

## 1. Conventions and global rules

| Topic | Rule |
|---|---|
| Language | Code, identifiers, comments, commit messages: English. Domain terms may stay German/Turkish in docs. UI text only from `messages/` (de + en, always both). |
| Paths | `@/*` → `src/*` (tsconfig `paths`). Tests import app code through `@/`. |
| DB access | **Only** in `src/server/services/*.ts`. Pages, layouts, components, route handlers and server actions call services. Scripts (`scripts/*`) call services too; test factories (`tests/factories`) are the only other place allowed to write with Drizzle directly. |
| Authorization | Every exported, actor-facing service function receives `actor: Actor` as first argument and checks permissions itself (K§3). UI/layout checks are UX only. |
| Validation | Zod 4 schemas in `src/lib/validation/<domain>.ts` (isomorphic). Services parse their input with them (always, even if the form already did). |
| Constants | Only in `src/config/app.ts` (K§2). Env parsing in `src/config/env.ts`. No magic numbers elsewhere. |
| Colors | Only in `src/styles/tokens.css` as CSS variables. Components use Tailwind token classes (`bg-background`, `text-muted-foreground`, `bg-primary` ...), never raw colors. |
| Time | Store `timestamptz` (UTC). Display Europe/Berlin via next-intl formatter (`timeZone` set in request config). Date-only values (`start_date`) are `date` columns, handled as `YYYY-MM-DD` strings. |
| IDs | `uuid` everywhere (also Better Auth tables, `advanced.database.generateId: "uuid"`). |
| Column naming | Every Drizzle column gets an explicit snake_case SQL name, e.g. `firstName: text("first_name")`. Do not rely on Drizzle `casing`. TS property names are camelCase and, for Better Auth tables, must equal Better Auth field names. |
| Server-only | Every module under `src/server/**` starts with `import "server-only";` **except `src/server/db/schema/**`** (pure table definitions, loaded by drizzle-kit) **and the isomorphic pure modules `src/server/errors.ts`, `src/server/auth/types.ts`, `src/server/auth/permissions.ts`** (imported by `src/lib/domain/*` and client code; no Node/DB access). `server-only@0.0.1` throws on import unless the `react-server` condition applies, so: Vitest aliases it to an empty module (§8); every Node script runs as `tsx --import ./scripts/lib/server-only-shim.mjs scripts/<x>.ts` (package.json scripts **and** the Docker `tools` stage). The shim (F1) uses Node 24 `module.registerHooks()` to resolve `server-only` to an empty `data:` URL. Never use `--conditions=react-server` (it also switches react/react-dom to server builds and breaks react-email `render`). Services must **not** import `next/*` (no `headers()`, `cookies()`, `revalidatePath`) so they stay testable; that is the job of actions/route handlers. |
| Logging | `src/server/logger.ts` (pino). Never log passwords, tokens, cookies, invitation links, mail bodies. Redact paths are configured there. Log only errors and mutations (action name, entity id, actor id), never content. **Never** log view/read events, i.e. no user id + page id pairs for reads and no request paths tied to a user (that would be a page-view history, K§5/K§10). No request/access logging middleware. |
| Behaviour data | Never store reading time, scroll position, page views (K§5). Only completion + timestamp. `sessions.ip_address` / `user_agent` are kept only because Better Auth stores them for security and rate limiting; they disappear with the session row (sign-out, expiry, deactivation). W4 documents this in the Projektdoku, W3-delivery in `docs/runbook.md`. |
| DB errors | Services catch Postgres errors they can race into and rethrow `AppError` via `rethrowDbError(e, map)` from `src/server/errors.ts` (F1): `23503` (FK) ⇒ `IN_USE` on delete paths / `CONFLICT` on insert/update paths, `23505` (unique) ⇒ `CONFLICT` (or `EMAIL_TAKEN` on users.email), `40P01` (deadlock) ⇒ `CONFLICT`. `runAction`/`withActor` apply the same default mapping to anything uncaught, so races never surface as `INTERNAL`. |
| Ordering | Every ordered list sorts by `(sort_order, created_at, id)` (ties are stable). New rows get `max(sort_order)+1` while holding a lock on the parent row (module / template / user) `FOR UPDATE`; `move*` swaps two neighbours in one transaction with both rows locked `FOR UPDATE`. |

---

## 2. Data model (Drizzle)

### 2.1 File layout and the schema freeze rule

```
src/server/db/
├─ client.ts              # pg Pool + drizzle(); exports db, Db, Tx, DbExecutor
├─ types.ts               # InferSelectModel/InferInsertModel aliases for every table
└─ schema/
   ├─ index.ts            # re-exports everything below (the only import path: "@/server/db/schema")
   ├─ custom-types.ts     # tsvector customType
   ├─ enums.ts            # all pgEnums (values imported from src/config/app.ts)
   ├─ auth.ts             # users, sessions, accounts, verifications (Better Auth + our user fields)
   ├─ org.ts              # departments, teams, job_roles
   ├─ content.ts          # modules, pages, uploads, page_edit_locks
   ├─ templates.ts        # templates, template_steps
   ├─ plans.ts            # user_template_assignments, user_plan_steps, page_completions
   ├─ notifications.ts    # notifications
   ├─ events.ts           # events
   ├─ invitations.ts      # invitations
   └─ relations.ts        # drizzle relations() for all tables
drizzle/
├─ 0000_initial.sql       # generated by drizzle-kit, committed
└─ meta/                  # drizzle-kit journal + snapshot, committed
```

Schema files import with **relative paths** (e.g. `../../../config/app`), never `@/`, because drizzle-kit's loader
does not resolve tsconfig `paths`; they do not import `server-only` (§1). F1 verifies with `pnpm db:generate`.

**Schema freeze rule.** The complete schema below and the initial migration `drizzle/0000_initial.sql` are implemented
in **F1**. After F1 is merged, no unit edits `src/server/db/schema/**` or existing migration files. If a later unit
truly needs a schema change, it stops and files a contract change request to the orchestrator (see §13). The
orchestrator generates a **new** migration on `main` named after the unit id
(`pnpm db:generate --name w2_plans_<what>` → `drizzle/0001_w2_plans_<what>.sql`), never two in parallel, because the
drizzle-kit journal (`drizzle/meta/_journal.json`) would conflict.

`client.ts` uses `pg` (node-postgres) with `drizzle-orm/node-postgres`, a module-level singleton (cached on
`globalThis` in dev to survive HMR), connection string from `env.DATABASE_URL`, read lazily at first use (tests set the
env before first use). Exports:

```ts
export const db: Db;                                   // lazy proxy/getter, see implementation
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbExecutor = Db | Tx;                      // internal helpers accept either
export async function closeDb(): Promise<void>;        // for scripts/tests
```

### 2.2 Enums (`schema/enums.ts`)

Value arrays live in `src/config/app.ts` and are reused by pgEnum, zod and UI (single definition).

| pgEnum (SQL name) | Values |
|---|---|
| `user_role` | `admin`, `team_lead`, `employee` |
| `onboarding_status` | `active`, `completed`, `archived` |
| `locale` | `de`, `en` |
| `theme` | `light`, `dark`, `system` |
| `page_status` | `draft`, `published`, `archived` |
| `template_status` | `active`, `archived` |
| `phase` | `before_start`, `first_day`, `first_week`, `first_month` (declaration order = display order; exact labels in §7 `enums.phase.*`) |
| `notification_type` | `step_added`, `page_updated`, `event_announced`, `employee_assigned`, `onboarding_completed` |

### 2.3 Tables

Notation: `PK` primary key, `FK→t(c) [action]` foreign key with ON DELETE action, `NN` not null, `UQ` unique.
All `*_at` columns are `timestamp with time zone`, Drizzle `mode: "date"`. `created_at`/`updated_at` default `now()`;
`updated_at` uses Drizzle `.$onUpdate(() => new Date())` and services also set it explicitly where meaningful.
UUID PKs default `gen_random_uuid()` (`.defaultRandom()`).

#### `users` (Better Auth `user` model + admin plugin + our fields) — `schema/auth.ts`

| TS prop | column | type | null | default | notes |
|---|---|---|---|---|---|
| id | id | uuid | NN | random | PK |
| name | name | text | NN | | Better Auth display name; users service keeps it `firstName + " " + lastName` |
| email | email | text | NN | | UQ `users_email_uq`; always stored lower-cased (service normalizes) |
| emailVerified | email_verified | boolean | NN | false | set true when invitation accepted |
| image | image | text | null | | unused in v1 (Better Auth core field) |
| createdAt | created_at | timestamptz | NN | now() | |
| updatedAt | updated_at | timestamptz | NN | now() | |
| role | role | user_role | NN | 'employee' | admin plugin field (single app permission, K§3) |
| banned | banned | boolean | NN | false | admin plugin; `true` ⇔ account deactivated (blocks sign-in) |
| banReason | ban_reason | text | null | | `"deactivated"` when archived |
| banExpires | ban_expires | timestamptz | null | | always null (permanent until reactivation) |
| firstName | first_name | text | NN | | |
| lastName | last_name | text | NN | | |
| teamId | team_id | uuid | null | | FK→teams(id) [restrict]; department derived from team |
| jobRoleId | job_role_id | uuid | null | | FK→job_roles(id) [restrict] |
| leadId | lead_id | uuid | null | | FK→users(id) [restrict] (self reference) |
| startDate | start_date | date (mode string) | null | | |
| locale | locale | locale | NN | 'de' | UI language |
| theme | theme | theme | NN | 'system' | |
| onboardingStatus | onboarding_status | onboarding_status | NN | 'active' | see §3.2 |
| onboardingCompletedAt | onboarding_completed_at | timestamptz | null | | set on → completed, cleared on → active |
| archivedAt | archived_at | timestamptz | null | | set on → archived, cleared on reactivation |

Constraints/indexes: `users_email_uq` (email); `users_lead_not_self_ck` CHECK (`lead_id IS NULL OR lead_id <> id`);
indexes `users_lead_id_idx`, `users_team_id_idx`, `users_job_role_id_idx`, `users_onboarding_status_idx`.

Nullability of team/jobRole/lead/startDate is enforced per role by zod + service (DB stays nullable because admins
and the first admin have none):

| role | teamId | jobRoleId | leadId | startDate |
|---|---|---|---|---|
| employee | required | required | required | required |
| team_lead | required | required | optional | required |
| admin | optional | optional | optional | optional |

`leadId` must point to a non-archived user with role `team_lead` or `admin`, never self, and must not create a cycle
(recursive CTE walk up the lead chain ⇒ `VALIDATION`). The rule is checked **only when `leadId` is set or changed**
(an employee whose lead was deactivated later stays editable; see `deactivateUser`). Code that reads a lead as a
notification recipient always filters out archived leads.

#### `sessions` (Better Auth `session`)

| TS prop | column | type | null | default | notes |
|---|---|---|---|---|---|
| id | id | uuid | NN | random | PK |
| expiresAt | expires_at | timestamptz | NN | | |
| token | token | text | NN | | UQ `sessions_token_uq` |
| createdAt / updatedAt | created_at / updated_at | timestamptz | NN | now() | |
| ipAddress | ip_address | text | null | | |
| userAgent | user_agent | text | null | | |
| userId | user_id | uuid | NN | | FK→users(id) [cascade]; index `sessions_user_id_idx` |
| impersonatedBy | impersonated_by | text | null | | admin plugin field; always null because `/admin/impersonate-user` is disabled (§5.3) |

#### `accounts` (Better Auth `account`)

| TS prop | column | type | null | notes |
|---|---|---|---|---|
| id | id | uuid | NN | PK |
| accountId | account_id | text | NN | for credential accounts = user id |
| providerId | provider_id | text | NN | `"credential"` in v1 (SSO = v2) |
| userId | user_id | uuid | NN | FK→users(id) [cascade]; index `accounts_user_id_idx` |
| accessToken, refreshToken, idToken | access_token, refresh_token, id_token | text | null | unused in v1 |
| accessTokenExpiresAt, refreshTokenExpiresAt | access_token_expires_at, refresh_token_expires_at | timestamptz | null | |
| scope | scope | text | null | |
| password | password | text | null | Better Auth scrypt hash; null until invitation accepted |
| createdAt / updatedAt | created_at / updated_at | timestamptz | NN | now() |

UQ `accounts_provider_account_uq` (provider_id, account_id).

#### `verifications` (Better Auth `verification`)

| TS prop | column | type | null |
|---|---|---|---|
| id | id | uuid | NN, PK |
| identifier | identifier | text | NN, index `verifications_identifier_idx` |
| value | value | text | NN |
| expiresAt | expires_at | timestamptz | NN |
| createdAt / updatedAt | created_at / updated_at | timestamptz | NN, now() |

Used by Better Auth for **password reset only** (1 h, `resetPasswordTokenExpiresIn`).

#### `invitations` — `schema/invitations.ts`

Decision: **custom table, not the Better Auth `verification` table.** Justification: (1) the invite needs a 72 h
lifetime while Better Auth's reset token lifetime is one global value (1 h); (2) the admin UI must show invite state
(pending / expired / accepted) and "resend" must revoke earlier links — that needs our own columns; (3) writing rows
in Better Auth's internal identifier format (`reset-password:<token>`) would couple us to undocumented internals.
Password hashing on acceptance uses `hashPassword` from `better-auth/crypto`, i.e. the same scrypt hasher Better Auth
verifies with (we never customise the hasher).

| TS prop | column | type | null | default | notes |
|---|---|---|---|---|---|
| id | id | uuid | NN | random | PK |
| userId | user_id | uuid | NN | | FK→users(id) [cascade]; index `invitations_user_id_idx` |
| tokenHash | token_hash | text | NN | | SHA-256 hex of the raw token; UQ `invitations_token_hash_uq`. Raw token (32 random bytes, base64url) exists only in the mail link |
| expiresAt | expires_at | timestamptz | NN | | `created_at + APP_CONFIG.auth.inviteTokenTtlHours` |
| acceptedAt | accepted_at | timestamptz | null | | single use |
| revokedAt | revoked_at | timestamptz | null | | set when resent / user deactivated |
| createdBy | created_by | uuid | null | | FK→users(id) [set null] |
| createdAt | created_at | timestamptz | NN | now() | |

A token is valid ⇔ `accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()` and the user is not archived.

#### `departments`, `teams`, `job_roles` — `schema/org.ts`

Organisation names are data (not UI strings) and single-language.

| table | columns |
|---|---|
| departments | id uuid PK · name text NN UQ `departments_name_uq` · created_at · updated_at |
| teams | id uuid PK · department_id uuid NN FK→departments(id) [restrict] · name text NN · created_at · updated_at · UQ `teams_department_name_uq` (department_id, name) · index `teams_department_id_idx` |
| job_roles | id uuid PK · name text NN UQ `job_roles_name_uq` · created_at · updated_at |

Deletion (K§8): allowed only if unused. "Used" = **people or templates** reference it, as K§8 lists them:
department ⇔ users in any of its teams OR templates on the department or on any of its teams; team ⇔ users or templates;
job role ⇔ users or templates. A department whose teams are all empty is unused: `deleteDepartment` deletes those empty
teams and the department in one transaction, and the simple confirm dialog lists the teams that go with it
(`getDepartmentUsage` returns `{ used, users, templates, emptyTeams }`). FKs are RESTRICT as a safety net; the service
locks the row (`FOR UPDATE`), checks, and maps a racing `23503` to `IN_USE`.

#### `modules` — `schema/content.ts`

| column | type | null | default | notes |
|---|---|---|---|---|
| id | uuid | NN | random | PK |
| title_de | text | NN | | |
| title_en | text | null | | fallback to DE |
| sort_order | integer | NN | 0 | index `modules_sort_idx` |
| created_at / updated_at | timestamptz | NN | now() | |

A module can be deleted only when it has no pages (any status) (otonom karar).

#### `pages` — `schema/content.ts`

| TS prop | column | type | null | default | notes |
|---|---|---|---|---|---|
| id | id | uuid | NN | random | PK |
| moduleId | module_id | uuid | NN | | FK→modules(id) [restrict] |
| status | status | page_status | NN | 'draft' | §3.1 |
| titleDe | title_de | text | NN | | |
| titleEn | title_en | text | null | | EN optional; null ⇒ show DE + "Nur auf Deutsch verfügbar" (see "EN availability" below) |
| contentDe | content_de | jsonb (`$type<TiptapDoc>()`) | NN | `{"type":"doc","content":[]}` | Tiptap JSON |
| contentEn | content_en | jsonb | null | | |
| textDe | text_de | text | NN | '' | plain text extracted from content_de on every save |
| textEn | text_en | text | null | | |
| searchDe | search_de | tsvector | NN | generated | `GENERATED ALWAYS AS (setweight(to_tsvector('german', coalesce(title_de,'')),'A') \|\| setweight(to_tsvector('german', coalesce(text_de,'')),'B')) STORED` |
| searchEn | search_en | tsvector | NN | generated | same with `'english'`, `title_en`, `text_en` |
| sortOrder | sort_order | integer | NN | 0 | order inside module |
| contentUpdatedAt | content_updated_at | timestamptz | NN | now() | bumped on every content save (any status); drives the "Seit deinem Abschluss aktualisiert" badge **and is the displayed "last edited at"** (K§4) |
| updatedBy | updated_by | uuid | null | | FK→users(id) [set null]; "last edited by" (K§4); set together with `content_updated_at` on every content save, never elsewhere |
| createdAt / updatedAt | created_at / updated_at | timestamptz | NN | now() | technical; `updated_at` also moves on sort/module/status changes and is **not** shown as "last edited" |

Indexes: `pages_module_sort_idx` (module_id, sort_order), `pages_status_idx` (status),
`pages_search_de_idx` GIN (search_de), `pages_search_en_idx` GIN (search_en).
CHECK `pages_en_all_or_nothing_ck`: `(title_en IS NULL) = (content_en IS NULL) AND (title_en IS NULL) = (text_en IS NULL)`.

**EN availability (one definition).** Pure helper `hasEnglish({ titleEn, contentEn })` in
`src/lib/domain/locale-content.ts` (F1): `titleEn.trim() !== ""` AND `contentEn` is non-null AND not an empty doc (it
contains at least one non-whitespace text node or an image). `content.ts` zod refine: EN title and EN content are both
filled or both empty (`VALIDATION`, field `titleEn`/`contentEn`). On save, `pages.savePageContent` writes `title_en`,
`content_en`, `text_en` all **null** unless `hasEnglish` is true, so in SQL "EN available" ⇔ `title_en IS NOT NULL`
(guaranteed by the CHECK above). `isFallback`, the renderer's language choice and the search language all use this
(TS: `hasEnglish`; SQL: `title_en IS NOT NULL`). Same rule for events (`title_en`/`description_en`, helper
`hasEnglishEvent`, CHECK `events_en_all_or_nothing_ck`) and modules (only `title_en`; empty string stored as null).
Drizzle: `customType<{ data: string }>({ dataType: () => "tsvector" })` + `.generatedAlwaysAs(sql\`...\`)`; the
regconfig is written literally (`'german'::regconfig`) so the expression is immutable.

#### `uploads` — `schema/content.ts`

| column | type | null | notes |
|---|---|---|---|
| id | uuid NN | | PK; public reference in content: `/api/uploads/<id>` |
| page_id | uuid | null | FK→pages(id) [cascade]; access control derives from the page; null ⇒ admin-only |
| storage_key | text NN | | UQ `uploads_storage_key_uq`; key inside the StorageAdapter (`<yyyy>/<mm>/<uuid>.<ext>`) |
| original_name | text NN | | sanitized |
| mime_type | text NN | | detected from magic bytes, one of `APP_CONFIG.uploads.allowedMimeTypes` |
| size_bytes | integer NN | | ≤ `APP_CONFIG.uploads.maxBytes` |
| uploaded_by | uuid | null | FK→users(id) [set null] |
| created_at | timestamptz NN | now() | |

Index `uploads_page_id_idx`. When a page is hard-deleted, rows cascade and the pages service deletes the files via the
StorageAdapter after commit. No orphan-file cleanup job in v1.
An image may only be referenced by the page it was uploaded for: `savePageContent` collects every `/api/uploads/<id>`
src after sanitizing and rejects the save with `VALIDATION` (`details.reasonKey: "editor.errors.foreignImage"`) if any
id is unknown, has `page_id IS NULL`, or belongs to another page. So access control by `uploads.page_id` always
matches where the image is shown, and hard-deleting page A can never break page B.

#### `page_edit_locks` — `schema/content.ts` (K§4 lease)

| column | type | null | notes |
|---|---|---|---|
| page_id | uuid NN | | **PK**, FK→pages(id) [cascade] |
| user_id | uuid NN | | FK→users(id) [cascade] |
| acquired_at | timestamptz NN | | |
| expires_at | timestamptz NN | | `now() + leaseDuration` on acquire/heartbeat; all comparisons use DB `now()` |

An expired row counts as free. No cleanup job.

#### `templates`, `template_steps` — `schema/templates.ts`

`templates`

| column | type | null | default | notes |
|---|---|---|---|---|
| id | uuid | NN | random | PK |
| name | text | NN | | admin/lead facing, single language |
| description | text | null | | |
| department_id | uuid | null | | FK→departments(id) [restrict]; **null = "Alle" (company-wide)** |
| team_id | uuid | null | | FK→teams(id) [restrict]; must belong to department_id (service check) |
| job_role_id | uuid | null | | FK→job_roles(id) [restrict] |
| status | template_status | NN | 'active' | |
| created_by / updated_by | uuid | null | | FK→users(id) [set null] |
| created_at / updated_at | timestamptz | NN | now() | |

CHECK `templates_team_requires_department_ck` (`team_id IS NULL OR department_id IS NOT NULL`).
Indexes `templates_department_id_idx`, `templates_status_idx`.

`template_steps`

| column | type | null | notes |
|---|---|---|---|
| id | uuid NN | | PK |
| template_id | uuid NN | | FK→templates(id) [cascade] |
| page_id | uuid NN | | FK→pages(id) [restrict] |
| phase | phase NN | | |
| sort_order | integer NN | default 0 | order inside (template, phase) |
| created_at | timestamptz NN | now() | |

UQ `template_steps_template_page_uq` (template_id, page_id); index `template_steps_order_idx`
(template_id, phase, sort_order); index `template_steps_page_id_idx`.

#### `user_template_assignments`, `user_plan_steps`, `page_completions` — `schema/plans.ts`

`user_template_assignments` (record of which templates were assigned; drives "template used" and the lead UI)

| column | type | null | notes |
|---|---|---|---|
| id | uuid NN | | PK |
| user_id | uuid NN | | FK→users(id) [cascade] |
| template_id | uuid NN | | FK→templates(id) [restrict] (template in use ⇒ archive instead of delete) |
| assigned_by | uuid | null | FK→users(id) [set null] |
| assigned_at | timestamptz NN | now() | updated when re-assigned |

UQ `uta_user_template_uq` (user_id, template_id); index `uta_template_id_idx`.

`user_plan_steps` (the personal plan = snapshot, K§5)

| column | type | null | notes |
|---|---|---|---|
| id | uuid NN | | PK |
| user_id | uuid NN | | FK→users(id) [cascade] |
| page_id | uuid NN | | FK→pages(id) [restrict] |
| phase | phase NN | | copied from template step or chosen by lead |
| sort_order | integer NN | | order inside (user, phase) |
| source_template_id | uuid | null | FK→templates(id) [set null]; null = added manually from library |
| added_by | uuid | null | FK→users(id) [set null] |
| created_at | timestamptz NN | now() | |

UQ `ups_user_page_uq` (user_id, page_id) — this is the dedupe guarantee ("same page in several templates appears once").
Indexes `ups_user_order_idx` (user_id, phase, sort_order), `ups_page_id_idx` (page_id).

`page_completions`

| column | type | null | notes |
|---|---|---|---|
| user_id | uuid NN | | FK→users(id) [cascade] |
| page_id | uuid NN | | FK→pages(id) [restrict] |
| completed_at | timestamptz NN | now() | the only tracked datum (DSGVO / BetrVG) |

PK (user_id, page_id); index `page_completions_page_id_idx`.

Decision: **completions are a separate table keyed by (user, page), not a column on the plan step, and they are kept
when a step is removed.** Justification: K§5/K§8 require completion records to survive team/lead changes and page
archiving; keying by page (not by step id) means a step that is removed and later re-added (or re-added by assigning
another template) shows its earlier completion instead of forcing the employee to redo it; and removing a plan step is a
plain `DELETE` on `user_plan_steps` without losing history. Progress only counts completions whose page is currently an
**active** step (§4.6), so orphan completions never inflate progress. Undo ("geri alma") deletes the completion row.
Permanent user deletion cascades everything.

#### `notifications` — `schema/notifications.ts`

| column | type | null | default | notes |
|---|---|---|---|---|
| id | uuid | NN | random | PK |
| user_id | uuid | NN | | recipient, FK→users(id) [cascade] |
| type | notification_type | NN | | |
| message_key | text | NN | | i18n key in namespace `notificationItems`, e.g. `notificationItems.pageUpdated` |
| params | jsonb | NN | `'{}'` | primitives only, see §4.8 |
| link | text | null | | app-relative path built with `ROUTES` |
| page_id | uuid | null | | FK→pages(id) [set null] |
| event_id | uuid | null | | FK→events(id) [set null]; null on an `event_announced` row ⇒ render "Veranstaltung entfernt" |
| subject_user_id | uuid | null | | employee the notification is about, FK→users(id) **[cascade]**: permanently deleting a user also deletes every notification about them (their name is in `params`, DSGVO, K§5/K§8) |
| dedupe_key | text | null | | see §4.8 |
| read_at | timestamptz | null | | |
| created_at | timestamptz | NN | now() | first occurrence |
| occurred_at | timestamptz | NN | now() | latest occurrence; bumped on dedupe; used for sorting, display and the 90-day retention |

Indexes: `notifications_user_feed_idx` (user_id, occurred_at DESC, id DESC); `notifications_user_unread_idx` (user_id) WHERE
`read_at IS NULL`; **partial unique** `notifications_dedupe_uq` (user_id, dedupe_key) WHERE
`read_at IS NULL AND dedupe_key IS NOT NULL`.

#### `events` — `schema/events.ts`

| column | type | null | default | notes |
|---|---|---|---|---|
| id | uuid | NN | random | PK |
| title_de | text | NN | | |
| title_en | text | null | | |
| description_de | text | NN | | plain multi-line text (no rich text) |
| description_en | text | null | | both EN fields set or both null (`events_en_all_or_nothing_ck`, §2.3 "EN availability") |
| starts_at | timestamptz | NN | | |
| ends_at | timestamptz | NN | | CHECK `events_time_range_ck` (`ends_at >= starts_at`) |
| location | text | null | | |
| last_announced_at | timestamptz | null | | |
| created_by / updated_by | uuid | null | | FK→users(id) [set null] |
| created_at / updated_at | timestamptz | NN | now() | |

Index `events_starts_at_idx`.

#### Better Auth mapping

`drizzleAdapter(db, { provider: "pg", schema: { user: users, session: sessions, account: accounts, verification: verifications } })`.
No `rateLimit` table (memory storage, single instance). If a Better Auth upgrade requires extra columns, that is a
contract change (§13).

---

## 3. State machines

Pure functions, no DB, no Next imports, unit-tested in F1. Location `src/lib/domain/` (isomorphic, so a server
component can compute allowed actions and pass them to client components).

### 3.1 Page status — `src/lib/domain/page-status.ts`

```
draft ──publish──► published ──archive──► archived
draft ◄─unpublish── published ◄─restore── archived
draft ──archive (only via "delete used page", K§8)──► archived
```

```ts
export type PageStatus = (typeof PAGE_STATUSES)[number];          // from config
export type PageAction = "publish" | "unpublish" | "archive" | "restore";
export const PAGE_TRANSITIONS: Record<PageStatus, Partial<Record<PageAction, PageStatus>>> = {
  draft:     { publish: "published", archive: "archived" },
  published: { unpublish: "draft", archive: "archived" },
  archived:  { restore: "published" },
};
export function allowedPageActions(status: PageStatus): PageAction[];
export function nextPageStatus(status: PageStatus, action: PageAction): PageStatus; // throws AppError("INVALID_TRANSITION")
export function isVisibleToEmployees(status: PageStatus): boolean;  // status === "published"
```

`draft → archived` is an addition to the K§4 diagram (otonom karar): deleting a *used* draft page must archive it (K§8).
`restore` always returns to `published` as in K§4.

Side effects (implemented in `pages.changePageStatus`, §4.5): on every transition call
`planHooks.onPageStatusChanged(tx, …)` (progress / onboarding recompute, re-publish notification).

### 3.2 Onboarding status — `src/lib/domain/onboarding-status.ts`

```
active ──progress reaches 100 %──► completed
  ▲                                    │
  └──── progress drops below 100 % ────┘   (new active step, undo, page published/restored/unpublished, plan emptied …)
active | completed ──deactivate──► archived ──reactivate──► active (then silent recompute, may become completed)
archived ──delete permanently──► (row deleted)
```

K§5 draws `completed → active` only for "yeni adım eklendi". The blueprint generalises it to **any** drop of the
active-step progress below 100 % (new step, undo, a plan page published/restored/unpublished, plan emptied); combined
with K§5 "her ulaşıldığında", undo + redo of the last step sends the completion notification again (deduped while
unread). This is proposed otonom karar **P1** (§14) for `kararlar.md` §13.

Reactivation (K§5 "arşiv ──yeniden aktive──► aktif"): status becomes `active`, then
`recomputeOnboardingStatusInTx(tx, { userId, notify: false })` runs, so a user whose plan was already 100 % done
silently returns to `completed` **without** an `onboarding_completed` notification (it is not a new completion).
Proposed otonom karar **P2** (§14).

```ts
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export type OnboardingEvent =
  | { type: "progress"; completed: number; total: number }
  | { type: "deactivate" }
  | { type: "reactivate" };
export interface OnboardingTransition { status: OnboardingStatus; changed: boolean; becameCompleted: boolean }
export function applyOnboardingEvent(current: OnboardingStatus, event: OnboardingEvent): OnboardingTransition;
export function canDeletePermanently(status: OnboardingStatus): boolean;   // status === "archived"
```

Rules: `progress` with `total > 0 && completed === total` moves `active → completed` (`becameCompleted: true`); any
other progress moves `completed → active`; `progress` on `archived` is a no-op; `deactivate` on `archived` and
`reactivate` on non-archived throw `AppError("INVALID_TRANSITION")`. A user with an empty plan stays `active`.

Callers: `plans.ts` / `plan-hooks.ts` (progress, W2-plans), `users.ts` (deactivate/reactivate/delete, W1-org). Every
`becameCompleted` (with `notify` not false) ⇒ notification `onboarding_completed` to the recipient **set**
`onboardingCompletedRecipientsInTx(tx, subjectUserId)` (F2a, §4.8) = ({lead, if set and not archived} ∪ {all
non-archived admins}) minus the subject user (K§5, "her ulaşıldığında" — every time). A set, because the lead is
often an admin.

---

## 4. Service layer

### 4.1 Actor, permissions, errors

`src/server/auth/types.ts` (F1)

```ts
export type Role = "admin" | "team_lead" | "employee";
export interface Actor {
  id: string; role: Role; email: string; firstName: string; lastName: string;
  locale: Locale; theme: Theme;
}
```

`src/server/auth/permissions.ts` (F1; pure; mirrors K§3)

```ts
export const PERMISSIONS = {
  "plan.viewOwn": ["employee", "team_lead", "admin"],
  "plan.completeOwn": ["employee", "team_lead", "admin"],
  "library.read": ["team_lead", "admin"],
  "plan.manage": ["team_lead", "admin"],          // + scope check: lead only for own employees
  "progress.viewOthers": ["team_lead", "admin"],  // + scope check
  "content.manage": ["admin"],                     // modules, pages, uploads, locks
  "templates.manage": ["admin"],
  "org.manage": ["admin"],                         // departments, teams, job roles
  "users.manage": ["admin"],
  "events.manage": ["admin"],                      // CRUD + announce
  "events.view": ["employee", "team_lead", "admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;
export function hasPermission(actor: Actor, p: Permission): boolean;
export function assertPermission(actor: Actor, p: Permission): void;                 // throws FORBIDDEN
export function canManagePlanOf(actor: Actor, target: { id: string; leadId: string | null }): boolean;
//   admin: always; team_lead: target.leadId === actor.id (a lead's own plan is managed by the lead's lead or an admin)
export function canViewProgressOf(actor: Actor, target: { id: string; leadId: string | null }): boolean;
//   self, admin, or lead of target
export function canAccessRoute(role: Role, pathname: string): boolean;               // uses APP_CONFIG ROUTE_ACCESS
```

Nobody can mark completion for someone else: `plans.setStepCompletion` only ever acts on `actor.id`.

`src/server/errors.ts` (F1)

```ts
export const ERROR_CODES = [
  "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION", "CONFLICT", "IN_USE",
  "INVALID_TRANSITION", "LOCK_HELD", "LOCK_LOST", "INVITE_INVALID", "INVITE_EXPIRED",
  "LAST_ADMIN", "FILE_TOO_LARGE", "FILE_TYPE_NOT_ALLOWED", "EMAIL_TAKEN", "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export class AppError extends Error {
  constructor(public code: ErrorCode, public details?: Record<string, unknown>, message?: string);
  get messageKey(): `errors.${ErrorCode}`;
}
export function isAppError(e: unknown): e is AppError;
export function rethrowDbError(e: unknown, map?: { fk?: ErrorCode; unique?: ErrorCode }): never;  // §1 "DB errors"
```

Services **throw** `AppError` (never return error unions). `details` carries structured data the UI needs, e.g.
`IN_USE: { users: {id,name}[], templates: {id,name}[], activePlanCount? }`, `LOCK_HELD: { holderName, since }`,
`VALIDATION: { fieldErrors: Record<string, string[]> }` (values are i18n keys).

**Reason keys.** A unit-specific failure reason does **not** need a new `ErrorCode`: services throw
`new AppError(code, { reasonKey: "<unitNamespace>.errors.<reason>", ...})` (e.g. `users.errors.cannotDeactivateSelf`,
`templates.errors.teamNotInDepartment`, `editor.errors.foreignImage`). `runAction`/`withActor` pass `details`
(incl. `reasonKey`) through; the UI renders `t(details.reasonKey ?? messageKey)`. The unit defines the reason text in
its own namespace file (de + en). New `ErrorCode`s therefore stay rare (contract change, §13).

### 4.2 Service function pattern

```ts
// src/server/services/org.ts
import "server-only";
export async function createDepartment(actor: Actor, input: CreateDepartmentInput): Promise<Department> {
  assertPermission(actor, "org.manage");                  // 1. authorize (before touching data)
  const data = createDepartmentSchema.parse(input);      // 2. validate (zod → VALIDATION via wrapper)
  return db.transaction(async (tx) => { … });            // 3. transact when >1 statement or read-then-write
}
```

- Input types are `z.input<typeof schema>`; outputs are plain serializable DTOs (Dates allowed; client props get ISO
  strings).
- Scope checks needing data (lead → own employee) load the target inside the same transaction.
- A not-visible entity is reported as `NOT_FOUND` (do not leak existence), wrong role on a known area as `FORBIDDEN`.
- Cross-service calls inside a transaction use the internal, non-actor variants that accept `tx: DbExecutor`
  (named `…InTx`, documented as "trusted caller, no auth check").
- Lock checks use `SELECT … FOR UPDATE`. Multi-row writes that must be atomic (assignment snapshot, deactivate) are one
  transaction.
- **Concurrency (READ COMMITTED, so read-then-write needs explicit row locks):**
  - *Per-user plan serialization.* Every transaction that changes a user's plan, completions or onboarding status
    first locks that user's row: `SELECT id, lead_id, role, onboarding_status FROM users WHERE id = $1 FOR UPDATE`
    (helper `lockUserInTx` in `src/server/services/row-locks.ts`, F2a, internal; not to be confused with the K§4
    edit lease in `locks.ts`). All later reads (scope check, progress, max sort_order) happen **after** the lock. Applies to `setStepCompletion`,
    `assignTemplates`, `addPlanStep`, `removePlanStep`, `reactivateUser`, `deactivateUser` and the recompute inside
    `plan-hooks`.
  - *Bulk.* Hooks that touch many users (`onPageStatusChanged`, `onPublishedPageContentChanged`) lock them with
    `SELECT id FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE` (helper `lockUsersInTx`).
  - *Lock order* (deadlock avoidance): page row(s) → user rows in ascending id. Plan services lock **only** the user
    row; they never lock pages afterwards. They read page status unlocked: a concurrent page status change waits for
    the user lock in its hook and recomputes afterwards, so the final state is always right. A page deleted between
    check and insert surfaces as `23503` ⇒ `CONFLICT` (no `FOR SHARE` on pages needed). `changePageStatus` locks its
    page with `FOR NO KEY UPDATE` (does not block the FK key-share locks taken by plan inserts).
  - *Admin invariants.* Last-admin checks first take `SELECT id FROM users WHERE role = 'admin' AND onboarding_status
    <> 'archived' FOR UPDATE`, then count. Setting a `leadId` locks the candidate lead `FOR SHARE`; demoting a user to
    `employee` locks the user `FOR UPDATE` before the `EXISTS (lead_id = target)` check, so both paths serialize on
    the lead's row.
- Mail is sent **after** commit (never inside a transaction); failures are logged and reported as a flag in the result.
- Services never call `revalidatePath`/`redirect`; actions do.

### 4.3 Zod

`src/lib/validation/common.ts` (F2a): `idSchema` (uuid), `localeSchema`, `phaseSchema`, `passwordSchema`
(min `APP_CONFIG.auth.passwordMinLength`, max `passwordMaxLength`), `emailSchema` (trim + lowercase),
`optionalText`, `tiptapDocSchema` (shape check `{type:"doc", content:[]}`; deep sanitation is W1-content's job) and a
zod error map that emits i18n keys (`validation.required`, `validation.tooShort` …). Each domain owns its own file
(`org.ts`, `users.ts`, `content.ts`, `templates.ts`, `plans.ts`, `events.ts`, `notifications.ts`, `search.ts`).

### 4.4 Module list and signatures

`Actor` first, `input` objects second. All return Promises. "(internal)" = no actor, trusted callers only.

**`profile.ts`** (F2b)
- `getProfile(actor) → ProfileDto`
- `updatePreferences(actor, { locale?, theme? }) → ProfileDto`

**`invitations.ts`** (F2a)
- `issueInvitationInTx(tx, { userId, createdBy }) → { token, expiresAt }` (internal; revokes open invites first)
- `sendInvitationEmail({ userId, token }) → { sent: boolean }` (internal; after commit; uses user locale)
- `resendInvitation(actor, { userId }) → { sent: boolean, expiresAt }` (admin; user must be non-archived and have no password yet)
- `getInvitationState(actor, { userId }) → "none" | "pending" | "expired" | "accepted"` (admin; returns `"accepted"`
  whenever the user has a credential account with a non-null password, whatever the invite rows say)
- `verifyInvitationToken(token) → { valid: true, email, firstName } | { valid: false, reason: "invalid" | "expired" | "used" }` (public)
- `acceptInvitation({ token, password }) → { email }` (public; one tx: lock invite row FOR UPDATE, validate, upsert
  credential account with `hashPassword(password)`, `email_verified = true`, `accepted_at = now()`, revoke other open
  invites, delete existing sessions of that user)

**`bootstrap.ts`** (F1)
- `createInitialAdmin({ email, password, firstName, lastName, locale }) → { userId }` (internal, scripts only; fails
  with `EMAIL_TAKEN`; creates user role `admin` + credential account; used by `seed:admin` and `seed:demo`)

**`health.ts`** (F1)
- `checkDatabase() → { ok: boolean }` (internal; `SELECT 1`; used by `GET /api/health`, so the route itself has no DB
  access, K§1)

**`row-locks.ts`** (F2a) — internal concurrency helpers (§4.2)
- `lockUserInTx(tx, userId) → { id, leadId, role, onboardingStatus } | null` (`FOR UPDATE`)
- `lockUsersInTx(tx, userIds) → string[]` (ascending id, `FOR UPDATE`)
- `lockActiveAdminsInTx(tx) → string[]` (`FOR UPDATE`, for last-admin checks)

**`visibility.ts`** (F2a) — the single "which pages may this actor see" rule (used by pages, uploads, plans, search;
nobody re-implements it)
- `canViewPageInTx(tx, actor, pageId) → boolean`
- `visiblePagesCondition(actor) → SQL` (Drizzle where-fragment over `pages`)
- Rule: employee ⇒ `status = 'published'` AND `EXISTS (user_plan_steps WHERE user_id = actor.id AND page_id =
  pages.id)`; team_lead ⇒ `status = 'published'` (library, which includes the lead's own plan pages); admin ⇒ any
  status (draft/published in lists and search; archived only where a caller explicitly asks, e.g. admin preview
  `getPageForView`, via option `{ includeArchived: true }` honoured for admins only).

**`notifications-core.ts`** (F2a) — see §4.8
- `createNotificationInTx(tx, input: NotificationInput) → { id, deduped: boolean }`
- `createNotificationsInTx(tx, inputs: NotificationInput[]) → { created: number, deduped: number }` (single statement,
  inputs de-duplicated first)
- `listActiveAdminIdsInTx(tx) → string[]`, `listActiveUserIdsInTx(tx) → string[]` (non-archived)
- `onboardingCompletedRecipientsInTx(tx, subjectUserId) → string[]` (lead if not archived ∪ non-archived admins, minus
  subject; a set)
- `employeeAssignedRecipientInTx(tx, { leadId, actorId }) → string | null` (the lead if not archived and ≠ actor)

**`plan-hooks.ts`** (stub in F2a, implemented by W2-plans) — the only coupling between content/org and plans:
- `onPublishedPageContentChanged(tx, { pageId, actorId }) → void`
- `onPageStatusChanged(tx, { pageId, from, to, actorId }) → void`
- `recomputeOnboardingStatusInTx(tx, { userId, notify?: boolean /* default true */ }) → void` (caller must already hold
  the user lock, §4.2)

**`org.ts`** (W1-org)
- `listDepartments(actor) → DepartmentWithTeams[]` (admin)
- `createDepartment(actor, { name })`, `updateDepartment(actor, { id, name })`
- `getDepartmentUsage(actor, { id }) → { used, users, templates, emptyTeams }`, `deleteDepartment(actor, { id })`
  (throws `IN_USE` with usage; when unused deletes its empty teams in the same tx, §2.3)
- `createTeam(actor, { departmentId, name })`, `updateTeam(actor, { id, name, departmentId })` (changing
  `departmentId` while any template references the team ⇒ `IN_USE` with those templates, reasonKey
  `org.errors.teamHasTemplates`; otherwise allowed — users derive their department from the team), `getTeamUsage`,
  `deleteTeam`
- `listJobRoles(actor)`, `createJobRole`, `updateJobRole`, `getJobRoleUsage`, `deleteJobRole`
- `listOrgOptions(actor) → { departments, teams, jobRoles }` (admin + team_lead; for selects/filters)

**`users.ts`** (W1-org)
- `listUsers(actor, { status?, role?, departmentId?, teamId?, q? }) → UserListItem[]` (admin)
- `getUser(actor, { id }) → UserDetail` (admin; includes invitation state)
- `listLeadCandidates(actor) → { id, name }[]` (admin; non-archived team_lead/admin)
- `createUser(actor, CreateUserInput) → { user, inviteSent }` (admin; tx: insert user, `issueInvitationInTx`,
  `employee_assigned` to `employeeAssignedRecipientInTx` (lead, unless archived or the actor); after commit
  `sendInvitationEmail`; `EMAIL_TAKEN` on duplicate, also via `23505` mapping)
- `updateUser(actor, UpdateUserInput) → UserDetail` (admin; lead change ⇒ `employee_assigned` to the new lead (same
  recipient rule); lead validated only when it changes (§2.3, incl. cycle check); email change allowed only before
  invite acceptance; **changing the role to `employee` while the user is `lead_id` of anyone ⇒ `IN_USE`** (admin →
  team_lead stays allowed); demoting the last active admin ⇒ `LAST_ADMIN`; locks per §4.2)
- `getUserDeactivationImpact(actor, { id }) → { ledEmployees: { id, name }[] }` (admin; non-archived users whose
  `lead_id` is this user, shown in the confirm dialog so the admin can reassign them first)
- `deactivateUser(actor, { id })` (admin; not self (`FORBIDDEN`, reasonKey `users.errors.cannotDeactivateSelf`); last
  admin protected (`lockActiveAdminsInTx`); tx: `lockUserInTx`, `applyOnboardingEvent(deactivate)`,
  `banned=true, ban_reason='deactivated', archived_at=now()`, delete sessions, revoke invites, delete own edit locks).
  Deactivating a lead who still leads people is **allowed** (warning via `getUserDeactivationImpact`); those
  employees keep the archived `lead_id` until reassigned, and no notification is ever written to an archived lead
  (recipient helpers filter). Proposed otonom karar **P4** (§14).
- `reactivateUser(actor, { id })` (admin; tx: `lockUserInTx`, `banned=false`, `ban_reason=null`, status `active`,
  `archived_at=null`, then `planHooks.recomputeOnboardingStatusInTx(tx, { userId, notify: false })` — no
  completion notification on reactivation, §3.2)
- `deleteUserPermanently(actor, { id, confirmName })` (admin; only `archived`; `confirmName` must equal full name;
  blocked with `IN_USE` while the user is `lead_id` of anyone; last-admin rule; one tx deletes the user row, which
  cascades sessions, accounts, invitations, plan steps, assignments, completions, own notifications **and every
  notification whose `subject_user_id` is this user** (FK cascade, §2.3) — no name stays in anyone's feed)

**`modules.ts`** (W1-content)
- `listModules(actor) → ModuleWithPages[]` (library.read; leads see only published pages)
- `createModule(actor, { titleDe, titleEn? })`, `updateModule(actor, { id, titleDe, titleEn? })`
- `moveModule(actor, { id, direction: "up" | "down" })`, `deleteModule(actor, { id })` (`IN_USE` if pages exist)

**`pages.ts`** (W1-content)
- `createPage(actor, { moduleId, titleDe }) → { id }` (draft, empty content; the editor always works on an existing page)
- `getPageForEdit(actor, { id }) → PageEditDto` (admin, both languages, lock state)
- `getPageForView(actor, { id }) → PageViewDto` (`{ title, content, isFallback, status, lastEditedAt, lastEditedByName }`
  where `lastEditedAt = content_updated_at` and `lastEditedByName` from `updated_by` (K§4, §2.3); visibility via
  `canViewPageInTx` (admin with `includeArchived`); `isFallback = !hasEnglish(page) && viewerLocale === "en"`)
- `savePageContent(actor, { id, titleDe, titleEn, contentDe, contentEn }) → PageEditDto` (tx: verify lock FOR UPDATE ⇒
  `LOCK_LOST`; sanitize docs; reject foreign image ids (§2.3 uploads); extract text; normalize EN to all-null unless
  `hasEnglish`; set `updated_by`, `content_updated_at`; if `published` ⇒ `planHooks.onPublishedPageContentChanged`)
- `changePageStatus(actor, { id, action }) → PageEditDto` (page row `FOR NO KEY UPDATE`; uses `nextPageStatus`; calls
  `planHooks.onPageStatusChanged`)
- `movePage(actor, { id, direction })`, `movePageToModule(actor, { id, moduleId })`
- `getPageDeletionImpact(actor, { id }) → { used, templateCount, planCount, activePlanCount, completionCount }`.
  **used ⇔ EXISTS template_steps OR EXISTS user_plan_steps (any user status) OR EXISTS page_completions for the page**
  (all three FKs are RESTRICT, and K§8 says completion records are kept). `activePlanCount` (plan holders with status
  active/completed) is what the dialog headline shows ("3 aktif planda bu sayfa var"); the other counts are listed.
- `deletePage(actor, { id, confirmName? }) → { result: "deleted" | "archived" }` (tx: page row `FOR NO KEY UPDATE`,
  compute `used`; unused ⇒ hard delete (+ files after commit); a reference inserted concurrently makes the DELETE fail
  with `23503` ⇒ `CONFLICT` with reasonKey `library.errors.pageBecameUsed`, the admin retries and gets the archive
  path; used ⇒ archive via the `changePageStatus` internals (hook included), requires `confirmName === titleDe`)
- `listLibrary(actor, { status? }) → LibraryModule[]`, `listPagesForPicker(actor) → { id, title, moduleTitle, status }[]`
  (both use `visiblePagesCondition`; the `status` input is honoured **only for admins**; team_leads always get
  `published` regardless of input)

**`locks.ts`** (W1-content) — K§4 lease
- `acquireLock(actor, { pageId }) → LockState` (`assertPermission("content.manage")`; `SELECT 1 FROM pages WHERE id = $1`
  ⇒ `NOT_FOUND`; then the single atomic upsert below. No row returned ⇒ read the holder; if that read is empty (the
  holder released in between) retry the upsert **once**; still held ⇒ `LOCK_HELD { holderName, since }`)
- `heartbeat(actor, { pageId }) → { held: true, expiresAt } | { held: false, holderName: string | null, since: Date | null }`
  (`UPDATE page_edit_locks SET expires_at = now() + make_interval(secs => $lease) WHERE page_id = $1 AND user_id = $2
  RETURNING expires_at`; 0 rows ⇒ run the acquire upsert, which succeeds when the lock is free or expired (laptop sleep,
  network blip ⇒ editor keeps working); only a lock currently held by **someone else** returns `held: false` with that
  holder; if the page/lock vanished entirely ⇒ `held: false, holderName: null`)
- `releaseLock(actor, { pageId }) → void` (deletes only own row)
- `takeOverLock(actor, { pageId }) → LockState` (unconditional upsert: `user_id = actor`, `acquired_at = now()`,
  `expires_at = now() + lease`)
- `getLockState(actor, { pageId }) → { holder: { id, name } | null, since, expiresAt, isMine }`
- `assertLockHeldInTx(tx, { pageId, userId }) → void` (internal, `FOR UPDATE`, mine and unexpired, else `LOCK_LOST`;
  K§4 — the save path does **not** auto-reacquire)

Acquire query (one statement; the lease is passed as seconds, never as a string interval):

```sql
INSERT INTO page_edit_locks (page_id, user_id, acquired_at, expires_at)
VALUES ($1, $2, now(), now() + make_interval(secs => $3))   -- $3 = APP_CONFIG.locks.leaseDurationSeconds
ON CONFLICT (page_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      acquired_at = CASE WHEN page_edit_locks.user_id = EXCLUDED.user_id
                         THEN page_edit_locks.acquired_at ELSE now() END,
      expires_at = EXCLUDED.expires_at
  WHERE page_edit_locks.expires_at < now() OR page_edit_locks.user_id = EXCLUDED.user_id
RETURNING *;   -- no row ⇒ held by someone else ⇒ read holder (retry once if gone) ⇒ LOCK_HELD
```

**`uploads.ts`** (W1-content)
- `uploadImage(actor, { pageId, fileName, bytes: Uint8Array }) → { id, url }` (admin; size ≤ max ⇒ else
  `FILE_TOO_LARGE`; type by magic bytes via `file-type` ∈ allowed ⇒ else `FILE_TYPE_NOT_ALLOWED`)
- `getImageForServing(actor, { id }) → { stream: ReadableStream, mimeType, sizeBytes }` (admin: any; others:
  `canViewPageInTx(tx, actor, upload.page_id)` must be true; `page_id IS NULL` or not visible ⇒ `NOT_FOUND`)

**`notifications.ts`** (implemented by F2a together with the core, so the core is testable end to end; W1-notify-events builds the route, bell and page on top and does not re-implement it)
- `listNotifications(actor, { cursor?, limit? }) → { items: NotificationDto[], nextCursor }` (own only; first purges
  own rows with `occurred_at < now() - retentionDays`; keyset cursor `(occurred_at, id)`:
  `WHERE (occurred_at, id) < ($1, $2) ORDER BY occurred_at DESC, id DESC`, so equal timestamps from one bulk insert
  are neither skipped nor duplicated)
- `getUnreadSummary(actor) → { unreadCount, latest: NotificationDto[] }` (bell + poll)
- `markRead(actor, { id })`, `markAllRead(actor)`

**`events.ts`** (W1-notify-events)
- `listEvents(actor) → { upcoming: EventDto[], past: EventDto[] }` (all roles; upcoming ⇔ `ends_at >= now()`;
  `EventDto` resolves title/description by viewer locale with `hasEnglishEvent`)
- `getEvent(actor, { id })`, `createEvent(actor, EventInput)`, `updateEvent(actor, { id, ...EventInput })`, `deleteEvent(actor, { id })` (admin)
- `announceEvent(actor, { id }) → { recipients: number }` (admin; all non-archived users incl. actor; dedupe key
  `event_announced:<id>`; sets `last_announced_at`; can be repeated)

**`templates.ts`** (W2-templates)
- `listTemplates(actor, { status? }) → TemplateListItem[]` (admin)
- `getTemplate(actor, { id }) → TemplateDetail` (steps grouped by phase, page status flags)
- `createTemplate(actor, { name, description?, departmentId, teamId?, jobRoleId? })`, `updateTemplate` — the
  department is **required** (K§5): zod `departmentId: z.union([idSchema, z.literal("all")])` without `.optional()`;
  the service maps `"all"` → `department_id = null`; a missing value is `VALIDATION`. The form has no preselection, the
  admin must pick a department or "Alle". `teamId` must belong to the department (`VALIDATION`, reasonKey
  `templates.errors.teamNotInDepartment`); not allowed with `"all"`.
- `addTemplateStep(actor, { templateId, pageId, phase })` (page must not be archived; a concurrently deleted page ⇒
  `23503` ⇒ `CONFLICT`), `removeTemplateStep(actor, { stepId })`,
  `moveTemplateStep(actor, { stepId, direction })`, `changeTemplateStepPhase(actor, { stepId, phase })`
- `archiveTemplate`, `restoreTemplate`, `getTemplateDeletionImpact`, `deleteTemplate(actor, { id, confirmName? }) → { result: "deleted" | "archived" }`
  (unused = no `user_template_assignments`)

**`plans.ts`** (W2-plans)
- `getMyPlan(actor) → PlanDto` (`{ status, progress, phases: { phase, steps: StepDto[] }[] }`; only active steps;
  `StepDto` has `pageId, title, isFallback, completedAt, updatedSinceCompletion`; empty ⇒ `phases: []`)
- `getPlanForUser(actor, { userId }) → EmployeePlanDto` (`canViewProgressOf`, not visible ⇒ `NOT_FOUND`; includes
  inactive steps flagged, module grouping data, assigned templates, progress, last activity. Non-published steps:
  admins see title + status; **team_leads see only a status flag (`title: null`)**, because they cannot read drafts in
  the library either)
- Internal `loadManageableTargetInTx(tx, actor, userId)`: `lockUserInTx`; missing user, or team_lead actor with
  `target.lead_id ≠ actor.id` ⇒ `NOT_FOUND` (existence does not leak); archived target ⇒ `INVALID_TRANSITION`;
  employee actor ⇒ `FORBIDDEN` (permission `plan.manage`). **Called first by every plans function that takes a
  `userId`** (the four below; the read-only `listAssignableTemplates`/`listAddablePages` use the same scope check
  without `FOR UPDATE`).
- `listAssignableTemplates(actor, { userId }) → { id, name, scope, suggested: boolean }[]` (active templates;
  suggested ⇔ `(dept IS NULL OR dept = user.dept) AND (team IS NULL OR team = user.team) AND (role IS NULL OR role = user.jobRole)`)
- `assignTemplates(actor, { userId, templateIds }) → { addedSteps: number }` (snapshot, below; any selected template
  that is archived or missing ⇒ `VALIDATION`, reasonKey `plan.errors.templateNotAssignable`, nothing assigned)
- `listAddablePages(actor, { userId }) → { id, title, moduleTitle }[]` (published pages not in plan)
- `addPlanStep(actor, { userId, pageId, phase }) → void` (inside the tx: page must be `published`, else `VALIDATION`
  reasonKey `plan.errors.pageNotPublished`; already in plan ⇒ `CONFLICT`)
- `removePlanStep(actor, { userId, pageId }) → void` (completion kept)
- `setStepCompletion(actor, { pageId, completed: boolean }) → { progress, status }` (own plan only — always
  `actor.id`, `lockUserInTx(actor.id)` first; page must be an active step)
- `getProgressForUsersInTx(tx, userIds) → Map<userId, { completed, total, percent, lastActivityAt }>` (internal; used by dashboards)

**`dashboards.ts`** (W3-dashboards)
- `getTeamOverview(actor) → TeamRow[]` (team_lead/admin: users where `lead_id = actor.id`; `{ id, name, startDate, percent, lastActivityAt, status }`)
- `getAdminOverview(actor, { departmentId?, teamId?, status? }) → OverviewRow[]` (admin; default excludes archived)

**`search.ts`** (W3-search)
- `search(actor, { q }) → { pages: { pageId, title, snippet: { text, highlights }[], moduleTitle }[], events: { eventId, title, startsAt, endsAt }[] }`

Scope (K§5 "Çalışan yalnızca planındaki sayfaları ve etkinlikleri görür; arama da yalnızca bunlarda yapılır"): pages
**and** events. Page visibility comes only from `visiblePagesCondition(actor)` (§4.4 `visibility.ts`); events are
visible to all roles. Page language: the variant the user would see — EN search (`search_en`, `english`) where
`title_en IS NOT NULL` (⇔ `hasEnglish`, §2.3) and the actor locale is `en`, otherwise DE (`search_de`, `german`).
Query with `websearch_to_tsquery`, rank with `ts_rank`, snippet with `ts_headline` using control-character delimiters
(`StartSel=\u0002, StopSel=\u0003`) that the UI splits into `<mark>` elements (never `dangerouslySetInnerHTML`). Events:
case-insensitive `ILIKE` over title and description in the viewer's language variant (LIKE wildcards in `q` escaped),
ordered by `starts_at DESC`; no tsvector column (small table). Minimum query length / max results from config.

### 4.5 Content ↔ plans hook contract (details)

- `savePageContent` on a `published` page ⇒ `onPublishedPageContentChanged`: W2 creates `page_updated` notifications
  for every user whose plan contains the page and whose status is `active` or `completed`, excluding the actor (the
  editor is not notified about their own edit — proposed otonom karar **P3**, §14), with dedupe key
  `page_updated:<pageId>` (K§6).
- `changePageStatus` ⇒ `onPageStatusChanged`: W2 locks the affected non-archived plan holders (`lockUsersInTx`,
  ascending id) and recomputes progress/onboarding status for each (publish/unpublish/archive/restore all change the
  active-step set). On `draft → published` W2 additionally sends `page_updated` to those plan holders (re-publish after
  draft edits; otonom karar). This also covers steps that pointed to a draft page when they were added (§4.6).
- Hooks run inside the caller's transaction; they must not send mail or call Next APIs.

### 4.6 Plans: snapshot, progress, recompute (W2-plans)

- **Active step** = plan step whose page status is `published`. Draft pages in a plan are hidden from the employee and
  excluded from progress; archived ones are excluded (K§5) (otonom karar for drafts).
- **Progress** = completions on active steps / active steps; `percent = total === 0 ? 0 : round(100*c/t)`. Pure helper
  `src/lib/domain/progress.ts` (W2-plans). Last activity = max `completed_at` of the user.
- **Snapshot** (`assignTemplates`, one tx): `loadManageableTargetInTx` (locks the user, scope check); load the selected
  templates — any archived/missing ⇒ `VALIDATION` — ordered by specificity (company-wide → department → team → job
  role, then name); iterate their steps ordered by phase, sort_order, created_at, id, skipping archived pages; insert
  with `ON CONFLICT (user_id, page_id) DO NOTHING` (first occurrence wins); `sort_order` = current max in that phase + 1
  in iteration order (safe: the user row is locked); upsert `user_template_assignments` (`assigned_at = now()`); if at
  least one inserted step's page is **`published`** ⇒ one `step_added` notification (dedupe key `plan_steps_added`) —
  inserted draft steps alone do not notify (the employee sees nothing new; the draft→published hook notifies later);
  then recompute status. Later template edits never touch plans (K§5.4). Re-assigning the same template inserts only
  missing steps.
- `addPlanStep` (page must be published) appends to the end of the phase, notifies `step_added`, recomputes.
  `removePlanStep` deletes the row, keeps the completion, recomputes.
- Recompute (caller holds the user lock): compute progress ⇒ `applyOnboardingEvent(progress)` ⇒ persist
  status/`onboarding_completed_at` ⇒ if `becameCompleted` and `notify !== false` ⇒ `onboarding_completed` to
  `onboardingCompletedRecipientsInTx(tx, userId)` (dedupe `onboarding_completed:<userId>`).
- Server action location: the "Erledigt" toggle renders on `/plan` and on `/pages/[pageId]` (W1-content's folder), but
  `setStepCompletionAction` lives in `src/app/(app)/plan/actions.ts` (W2-plans), imported by
  `src/components/plan/plan-step-actions.tsx`; it calls `revalidatePath(ROUTES.plan)` and
  `revalidatePath(ROUTES.page(pageId))`. General rule: a unit defines server actions only inside folders it owns.
- Team/lead change does not touch the plan (K§5.6).

### 4.7 Lease lock details (W1-content)

Heartbeat interval, lease duration, idle timeout and grace period come from `APP_CONFIG.locks`. All texts are message
keys in the `editor` namespace (quoted German below only identifies the K§4 wording). The editor client:
- acquire on open (if `LOCK_HELD` ⇒ read-only with banner `editor.lock.heldBy` (de "{name} bearbeitet diese Seite
  seit {time}") + button `editor.lock.takeOver` ("Bearbeitung übernehmen") with confirm ⇒ `takeOverLock`);
- heartbeat every `heartbeatIntervalMs`; on `held: false` switch to read-only and show `editor.lock.takenOver`
  (de "{name} hat die Bearbeitung übernommen") **only** when `holderName` is non-null and the holder is not me,
  otherwise `editor.lock.expired` (de "Sperre abgelaufen", en "Lock expired");
- after `idleTimeoutMs` without input show the dialog `editor.idle.prompt` (de "Bist du noch da?", en "Are you still
  there?"); no answer within `idlePromptGraceMs` ⇒ store the unsaved draft in `localStorage` (key
  `APP_CONFIG.draftStorageKeyPrefix + pageId`), release the lock, go read-only; on next open offer to restore the local
  draft;
- "Speichern und schließen" and `pagehide` ⇒ release (beacon). Save is rejected with `LOCK_LOST` unless the lock is
  mine and unexpired (`FOR UPDATE`).
- Tiptap 3 in the App Router: `useEditor({ immediatelyRender: false, extensions })` (otherwise SSR/hydration errors);
  the extension list is defined once in `src/lib/tiptap/extensions.ts` and used by both the editor and
  `@tiptap/static-renderer` (page view), so stored JSON always renders.

### 4.8 Notifications core API (F2a)

```ts
export type NotificationInput =
  | { userId: string; type: "step_added"; params?: Record<string, never> }
  | { userId: string; type: "page_updated"; pageId: string; params: { titleDe: string; titleEn: string | null } }
  | { userId: string; type: "event_announced"; eventId: string; params: { titleDe: string; titleEn: string | null; startsAt: string } }
  | { userId: string; type: "employee_assigned"; subjectUserId: string; params: { employeeName: string } }
  | { userId: string; type: "onboarding_completed"; subjectUserId: string; params: { employeeName: string } };
```

`createNotification(s)InTx` derives `message_key`, `link` and `dedupe_key` from the type (callers cannot pass free text).

**Recipients** are always built as sets of **non-archived** user ids by the helpers in §4.4 (`listActiveUserIdsInTx`,
`onboardingCompletedRecipientsInTx`, `employeeAssignedRecipientInTx`), never ad hoc:
- `onboarding_completed`: (lead if set and not archived ∪ non-archived admins) **minus the subject user** (an admin or
  lead with their own plan is not notified about themselves).
- `employee_assigned`: the lead if set, not archived and **not the actor** (an admin who names themselves as lead is
  not notified about their own action).
- `page_updated`: active/completed plan holders minus the editor (P3). `step_added`: the plan owner.
  `event_announced`: all non-archived users incl. the announcing admin.

**Bulk insert safety.** `createNotificationsInTx` first de-duplicates its inputs by `${userId}|${dedupeKey}` (last one
wins), because a single `INSERT … ON CONFLICT … DO UPDATE` aborts with "ON CONFLICT DO UPDATE command cannot affect
row a second time" when two input rows share the conflict key — which would roll back the caller's transaction (e.g.
the employee's last completion when their lead is also an admin). Created vs deduped counts come from
`RETURNING (xmax = 0) AS inserted`.

| type | message_key | link | dedupe_key |
|---|---|---|---|
| step_added | `notificationItems.stepAdded` | `ROUTES.plan` | `plan_steps_added` |
| page_updated | `notificationItems.pageUpdated` | `ROUTES.page(pageId)` | `page_updated:<pageId>` |
| event_announced | `notificationItems.eventAnnounced` (`eventRemoved` when `event_id` is null) | `ROUTES.events + "#event-<id>"`; **rendered as plain `ROUTES.events` when `event_id` is null** (deleted event, no dead anchor) | `event_announced:<eventId>` |
| employee_assigned | `notificationItems.employeeAssigned` | `ROUTES.teamMember(subjectUserId)` | `employee_assigned:<subjectUserId>` |
| onboarding_completed | `notificationItems.onboardingCompleted` | `ROUTES.teamMember(subjectUserId)` | `onboarding_completed:<subjectUserId>` |

**Dedupe semantics (K§6, generalised):** if the recipient already has an **unread** notification with the same
`dedupe_key`, no new row is created; the existing row gets `occurred_at = now()` and the new `params`/`link`
(`deduped: true`). Once read, the next occurrence creates a new row. Implemented as
`INSERT … ON CONFLICT (user_id, dedupe_key) WHERE read_at IS NULL AND dedupe_key IS NOT NULL DO UPDATE SET occurred_at = now(), params = EXCLUDED.params, link = EXCLUDED.link`
(Drizzle `onConflictDoUpdate({ target, targetWhere, set })`). Rendering picks `titleEn ?? titleDe` by viewer locale
before calling `t(messageKey, params)`. Retention: §4.4 `listNotifications`/`getUnreadSummary` purge rows older than
90 days for that user (no cron, K§2). No email notifications (v2).

---

## 5. Server actions, route handlers, polling, image serving

### 5.1 Actions

- Each route folder that mutates owns an `actions.ts` (`"use server"`) next to its `page.tsx`. Actions are thin: call
  one service, `revalidatePath`, return `ActionResult`.
- Wrapper `src/server/actions/run-action.ts` (F1, working implementation):

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; messageKey: string; fieldErrors?: Record<string, string[]>; details?: Record<string, unknown> } };
export async function runAction<T>(fn: (actor: Actor) => Promise<T>): Promise<ActionResult<T>>;  // UNAUTHENTICATED if no actor
export async function runPublicAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>>;
```

  It maps `AppError` → code/messageKey/details (incl. `details.reasonKey`, §4.1), `ZodError` → `VALIDATION` +
  `fieldErrors`, uncaught pg `23503`/`23505`/`40P01` → `CONFLICT` (§1), anything else → logged `INTERNAL`. Client
  forms use React 19 `useActionState` and render messages with `t(error.details?.reasonKey ?? error.messageKey)`. Types live in
  `src/lib/action-result.ts` (isomorphic).
- Forms: native inputs + server validation (no react-hook-form). Dates: `<input type="date">`; event times:
  `<input type="datetime-local">` interpreted in Europe/Berlin and converted with `@date-fns/tz` in
  `src/lib/datetime.ts`. Reordering: up/down buttons (no drag & drop library) (otonom karar).
- Confirm dialogs: `src/components/common/confirm-dialog.tsx` with two modes — simple, and "type the name to confirm"
  showing the impact list (K§8).

### 5.2 Route handlers

Wrapper `src/server/http/route.ts` (F2a):

```ts
// Next 16: route-handler params are a Promise. withActor awaits them and passes resolved params.
export function withActor<P extends Record<string, string> = Record<string, never>>(
  handler: (req: NextRequest, ctx: { actor: Actor; params: P }) => Promise<Response>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;
```

Returns `401` without session; maps `AppError` → HTTP (`FORBIDDEN 403`, `NOT_FOUND 404`, `VALIDATION 400`,
`CONFLICT/IN_USE 409`, `LOCK_HELD/LOCK_LOST 423`, `FILE_TOO_LARGE 413`, `FILE_TYPE_NOT_ALLOWED 415`, else 500) with
JSON `{ code, messageKey, details }` (same pg-error default mapping as `runAction`). For non-GET it rejects requests whose `Origin` is not `env.APP_URL` (CSRF guard
for beacon/fetch endpoints; server actions have Next's built-in check).

| Method + path | Owner | Purpose |
|---|---|---|
| `GET, POST /api/auth/[...all]` | F1 | Better Auth handler (`toNextJsHandler(auth)`); disabled paths answer 404 (§5.3) |
| `GET /api/health` | F1 | `health.checkDatabase()` ⇒ `{ ok }` (200/503); Docker healthcheck. No DB access in the route itself |
| `GET /api/notifications/poll` | W1-notify-events | `getUnreadSummary` → `{ unreadCount, latest }`; `Cache-Control: no-store` |
| `POST /api/locks/[pageId]/heartbeat` | W1-content | `heartbeat` |
| `POST /api/locks/[pageId]/release` | W1-content | `releaseLock` (works with `navigator.sendBeacon`) |
| `POST /api/uploads` | W1-content | multipart `{ file, pageId }` → `uploadImage` (route handler, not action: 5 MB > action body limit) |
| `GET /api/uploads/[uploadId]` | W1-content | `getImageForServing`; headers `Content-Type`, `Content-Length`, `Cache-Control: private, max-age=3600`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` |

**Polling.** Bell (client) calls `/api/notifications/poll` every `APP_CONFIG.notifications.pollIntervalMs` (60 s) and on
`visibilitychange → visible`; pauses while hidden. Lock heartbeat every `APP_CONFIG.locks.heartbeatIntervalMs` (30 s).
No SSE/WebSocket (v2).

### 5.3 Auth plumbing (F1 core, F2a mail + invitations)

`src/server/auth/auth.ts` (F1, working; F2a does not edit it):

```ts
betterAuth({
  baseURL: env.APP_URL, secret: env.BETTER_AUTH_SECRET, trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, { provider: "pg", schema: { user: users, session: sessions, account: accounts, verification: verifications } }),
  advanced: { database: { generateId: "uuid" } },
  disabledPaths: [...APP_CONFIG.auth.disabledPaths],   // see below; matched exactly in onRequest ⇒ 404
  emailAndPassword: {
    enabled: true, disableSignUp: true,
    minPasswordLength: APP_CONFIG.auth.passwordMinLength, maxPasswordLength: APP_CONFIG.auth.passwordMaxLength,
    resetPasswordTokenExpiresIn: APP_CONFIG.auth.resetPasswordTokenTtlSeconds,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword,          // imported from src/server/auth/reset-mail.ts (F1 stub: logs "not implemented", F2a fills)
  },
  session: { expiresIn: APP_CONFIG.auth.sessionExpiresInSeconds, updateAge: APP_CONFIG.auth.sessionUpdateAgeSeconds },
  // cookieCache stays DISABLED: deactivation must end sessions immediately (K§3.6)
  user: { additionalFields: { firstName, lastName, locale, theme, onboardingStatus /* all input: false */ } },
  rateLimit: { enabled: env.NODE_ENV !== "test", storage: "memory", window, max, customRules: { "/sign-in/email": …, "/request-password-reset": …, "/reset-password": … } },  // all values from APP_CONFIG.auth.rateLimit
  plugins: [admin({ defaultRole: "employee", adminRoles: ["admin"] }), nextCookies()],
});
```

**Disabled endpoints.** The `admin` plugin is kept **only** for its ban check at sign-in/session creation (K§1). All of
its HTTP endpoints, and the core endpoints that would bypass our services, are disabled. `APP_CONFIG.auth.disabledPaths`
(verified against better-auth 1.7.25):

```
/admin/create-user  /admin/update-user  /admin/remove-user  /admin/set-role  /admin/set-user-password
/admin/ban-user  /admin/unban-user  /admin/impersonate-user  /admin/stop-impersonating  /admin/list-users
/admin/get-user  /admin/list-user-sessions  /admin/revoke-user-session  /admin/revoke-user-sessions
/admin/has-permission
/update-user  /delete-user  /delete-user/callback  /change-email  /link-social  /unlink-account
/send-verification-email  /verify-email
/sign-up/email  /sign-in/social  /refresh-token  /get-access-token
```

Why: these would let an admin impersonate someone and mark steps "Erledigt" for them (K§3 forbids it for every role),
and skip last-admin protection, "leader cannot be demoted/deleted" (K§12), the invitation flow, onboarding status,
IN_USE checks and the NOT NULL name columns (`set-role` could even write `user` into the `user_role` enum);
`/update-user` would let anyone break `name = first + last`. The last four are added because they exist in `auth.api` (1.7.25) and are unused in v1: sign-up is already off via `disableSignUp`, no social providers are configured. Enabled are only: sign-in/email, sign-out, get-session,
list-sessions, revoke-session(s), revoke-other-sessions, request-password-reset, reset-password (+ `/reset-password/:token`
callback), change-password, plus the inert/own-data endpoints verify-password, update-session, list-accounts, account-info and `/callback/:id` (no providers configured), ok, error. F1 implements `auth.ts` with a lazy `getAuth()` singleton and a Proxy `auth` export so `next build` and tests need no secrets at import time. F1 integration test: (a) an admin session POSTing to `/api/auth/admin/set-role`
and `/api/auth/admin/impersonate-user` gets 404; (b) every endpoint path of `auth.api` (from the router) is either in an
explicit "enabled" list or in `disabledPaths`, so a Better Auth upgrade that adds endpoints fails the test.

**Password reset vs. invitation.** better-auth's `/reset-password` creates a credential account if none exists, so
"forgot password" could otherwise accept an expired/unused invitation outside our flow. Decision: `sendResetPassword`
(`reset-mail.ts`, F2a) sends **nothing** to a user who is banned/archived **or has no credential account with a
non-null password**; the request still answers neutrally (no account enumeration). The unmailed token is unusable.
An expired invite is fixed only by "resend invite" (K§3.2). `getInvitationState` returns `"accepted"` whenever a
credential password exists (§4.4). F2a acceptance covers both.

- `src/lib/auth-client.ts` (F1): `createAuthClient()` from `better-auth/react`, **without** `adminClient()` (admin
  endpoints are disabled).
- Login/forgot/reset run client-side through `authClient.signIn.email`, `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`, `authClient.resetPassword({ newPassword, token })`. Sign-in of a banned user returns Better Auth's banned error ⇒ show `auth.errors.deactivated`.
- User management is done by **our** services with Drizzle (create, update, ban flag, session deletion), not via
  Better Auth admin endpoints, so it is testable without HTTP and supports our three roles.
- `src/server/auth/actor.ts` (F1): `getActor(): Promise<Actor | null>` (React `cache`; `auth.api.getSession({ headers })`;
  returns `null` if banned or archived) and `requireActor(): Promise<Actor>` (throws `UNAUTHENTICATED`).
- `src/server/auth/guards.ts` (F1, for pages/layouts): `requirePageActor()` ⇒ `redirect(ROUTES.login + "?reason=session-ended")`
  when a session cookie is present but no valid session exists, plain `redirect(ROUTES.login)` otherwise;
  `requirePageRole(roles)` ⇒ `notFound()` when role not allowed (do not reveal admin pages).
- `src/proxy.ts` (F2b, Next 16 "proxy" = former middleware): optimistic check with `getSessionCookie()` from
  `better-auth/cookies`, **only in one direction**: no session cookie on an `(app)` path ⇒ redirect to
  `/login?next=…`. The proxy **never** redirects away from `(auth)` routes based on the cookie, because deactivation,
  `revokeSessionsOnPasswordReset` and `acceptInvitation` delete the session row but leave the cookie in the browser
  (that would loop /login → / → /login). Instead `/login` (server component) calls `getActor()` and redirects to `/`
  only when a **real** session exists; `/set-password`, `/forgot-password` and `/reset-password` never redirect a
  signed-in user. With `?reason=session-ended` the login page clears the stale cookie (client `authClient.signOut()`
  once) and shows `auth.sessionEnded`. Matcher excludes `/api`, `/_next`, static files. Real checks stay in layouts +
  services. F2b acceptance: deactivate a user while their cookie is still in the browser, then load `/login` ⇒ it
  renders, no redirect loop; `/set-password?token=…` works with a stale cookie.

### 5.4 Mail (F2a)

`src/server/mail/transport.ts`: nodemailer SMTP from env (`SMTP_HOST/PORT/SECURE/USER/PASSWORD`); when
`MAIL_TRANSPORT=memory` (tests) uses `jsonTransport` and pushes into `src/server/mail/outbox.ts`
(`getOutbox()`, `clearOutbox()`). `send.ts`: `sendMail({ to, subject, react })` renders with `render` from
`react-email` (HTML + plain text). Templates in `src/server/mail/templates/`: `layout.tsx`, `invite-email.tsx`
(button → `${APP_URL}/set-password?token=…`; expiry text `t("emails.invite.expiry", { hours:
APP_CONFIG.auth.inviteTokenTtlHours })` — never a literal "72"), `reset-password-email.tsx` (same pattern with the
reset TTL). Texts from namespace `emails`, loaded with next-intl `createTranslator` and `loadMessages(locale)` (works
outside requests). Sender `env.MAIL_FROM`. Mail templates contain no color values (mail clients cannot resolve the CSS variables of `tokens.css`, and colors may live only there), so they are neutral: the button is an outlined `currentColor` box. `sendInvitationEmail` and `getPasswordResetRecipient` (the "may this user receive a reset mail" rule used by `reset-mail.ts`) live in `invitations.ts`, because `src/server/auth/**` has no DB access. F1 deviation fixed by F2a: `NAMESPACES` was a single space-joined string (and one `messages/<locale>/<joined>.json` file per locale); it is now a proper array with one file per namespace.

---

## 6. Route map and navigation

No locale prefix. `(auth)` and `(app)` are route groups. "Owner" = unit that owns the folder after F2b's placeholder.

| Route | Access | Owner | Content |
|---|---|---|---|
| `/login` | public (valid session per `getActor()` ⇒ `/`; never by cookie alone, §5.3) | F2b | email + password, link to forgot |
| `/set-password?token=` | public | F2b | invitation acceptance (`verifyInvitationToken` / `acceptInvitation`) |
| `/forgot-password` | public | F2b | request reset mail (always shows neutral success) |
| `/reset-password?token=` | public | F2b | set new password |
| `/` | all signed-in | F2b | redirect: employee → `/plan`, team_lead → `/team`, admin → `/admin` |
| `/plan` | all | W2-plans | own plan grouped by phase, progress, "Dein Onboarding-Plan wird vorbereitet" when empty |
| `/pages/[pageId]` | all (service decides visibility) | W1-content | page view; EN fallback note; last edited; slot `<PlanStepActions pageId>` (W2) |
| `/events` | all | W1-notify-events | upcoming / past |
| `/search` | all | W3-search | `?q=`; pages + events (§4.4) |
| `/notifications` | all | W1-notify-events | full list, mark read / all read |
| `/profile` | all | F2b | language, theme |
| `/team` | team_lead, admin | W3-dashboards | own employees: progress %, start date, last activity |
| `/team/[userId]` | team_lead (own employees), admin | W2-plans | employee detail: per-module done/open, assign templates, add/remove steps |
| `/library` | team_lead, admin | W1-content | read-only library (published) |
| `/admin` | admin | W3-dashboards | overview of all employees, department/team/status filters |
| `/admin/users`, `/admin/users/new`, `/admin/users/[userId]` | admin | W1-org | list, create, edit, invite resend, deactivate/reactivate, delete |
| `/admin/org` | admin | W1-org | departments & teams |
| `/admin/job-roles` | admin | W1-org | job roles |
| `/admin/library` | admin | W1-content | modules + pages management, ordering, status |
| `/admin/library/pages/[pageId]/edit` | admin | W1-content | Tiptap editor DE/EN tabs, lock banner, images |
| `/admin/templates`, `/admin/templates/new`, `/admin/templates/[templateId]` | admin | W2-templates | template CRUD + steps |
| `/admin/events`, `/admin/events/new`, `/admin/events/[eventId]` | admin | W1-notify-events | event CRUD + announce |

Layout guards (F2b): `src/app/(app)/layout.tsx` → `requirePageActor()`; `(app)/team/layout.tsx` and
`(app)/library/layout.tsx` → `requirePageRole(["team_lead","admin"])`; `(app)/admin/layout.tsx` →
`requirePageRole(["admin"])`. `APP_CONFIG.routeAccess` holds the same prefix rules used by `canAccessRoute` (unit
tested). Every list page defines empty / loading (`loading.tsx` or Suspense skeleton) / error states (K§9).

**Navigation config** lives in `src/config/app.ts` as data (icons by name; mapping to lucide components in
`src/components/layout/nav-icons.ts`):

```ts
export const NAVIGATION = [
  { key: "plan",           href: ROUTES.plan,           icon: "list-checks",      roles: ["employee", "team_lead", "admin"] },
  { key: "events",         href: ROUTES.events,         icon: "calendar-days",    roles: ["employee", "team_lead", "admin"] },
  { key: "search",         href: ROUTES.search,         icon: "search",           roles: ["employee", "team_lead", "admin"] },
  { key: "team",           href: ROUTES.team,           icon: "users",            roles: ["team_lead", "admin"] },
  { key: "library",        href: ROUTES.library,        icon: "book-open",        roles: ["team_lead"] },
  { key: "adminOverview",  href: ROUTES.admin,          icon: "layout-dashboard", roles: ["admin"], section: "admin" },
  { key: "adminUsers",     href: ROUTES.adminUsers,     icon: "user-cog",         roles: ["admin"], section: "admin" },
  { key: "adminOrg",       href: ROUTES.adminOrg,       icon: "building-2",       roles: ["admin"], section: "admin" },
  { key: "adminJobRoles",  href: ROUTES.adminJobRoles,  icon: "briefcase",        roles: ["admin"], section: "admin" },
  { key: "adminLibrary",   href: ROUTES.adminLibrary,   icon: "library",          roles: ["admin"], section: "admin" },
  { key: "adminTemplates", href: ROUTES.adminTemplates, icon: "layers",           roles: ["admin"], section: "admin" },
  { key: "adminEvents",    href: ROUTES.adminEvents,    icon: "calendar-cog",     roles: ["admin"], section: "admin" },
] as const;
```

Labels: `nav.<key>`. Top bar (right side): `<NotificationBell />`, user menu (profile, theme, language, sign out).
Mobile: nav in a `Sheet`. `ROUTES` (also in `app.ts`) is the only place paths are written:
`login, setPassword, forgotPassword, resetPassword, home, plan, page(id), events, search, notifications, profile, team, teamMember(id), library, admin, adminUsers, adminUser(id), adminUserNew, adminOrg, adminJobRoles, adminLibrary, adminPageEdit(id), adminTemplates, adminTemplate(id), adminTemplateNew, adminEvents, adminEvent(id), adminEventNew`.

---

## 7. i18n layout

Deviation from K§1 "messages/de.json, en.json" (otonom karar, recorded in `kararlar.md`): messages are split per
namespace so parallel units never edit the same JSON file.

```
messages/
├─ de/<namespace>.json
└─ en/<namespace>.json
src/i18n/
├─ namespaces.ts   # export const NAMESPACES = [...] as const
├─ messages.ts     # loadMessages(locale): imports every messages/<locale>/<ns>.json and returns { [ns]: json }
├─ locale.ts       # resolveLocale(): actor.locale → NEXT_LOCALE cookie → Accept-Language (de/en) → "de"
└─ request.ts      # getRequestConfig: { locale, messages: await loadMessages(locale), timeZone: "Europe/Berlin" }
src/types/next-intl.d.ts   # AppConfig augmentation: Locale + Messages typed from the de/*.json files
```

next-intl is used **without i18n routing** (`createNextIntlPlugin("./src/i18n/request.ts")` in `next.config.ts`). The
locale switcher (profile + login page) calls an action that updates `users.locale` (signed in) and always sets the
`NEXT_LOCALE` cookie, then `router.refresh()`. **A namespace file contains the namespace's content directly, with no
wrapper key** (`messages/de/org.json` is `{ "departments": {…}, "errors": {…} }`, never `{ "org": {…} }`);
`loadMessages` nests it under the namespace name, and it is addressed as `useTranslations("org")`. F1 adds a unit test
(`tests/unit/i18n/no-wrapper.test.ts`) that fails if a namespace file has a single top-level key equal to its own
namespace name.

| Namespace | Content | Owner |
|---|---|---|
| `common` | app-wide actions (save, cancel, delete, edit, back, confirm), empty/loading/error texts, confirm dialog texts, "Nur auf Deutsch verfügbar" | F2b |
| `enums` | labels for roles, onboarding statuses, page statuses, template statuses, **phases**, locales, themes, notification types (phase labels fixed below) | F2b |
| `nav` | navigation + top bar + user menu labels | F2b |
| `auth` | login, set-password, forgot/reset pages, Better Auth error mapping | F2b |
| `profile` | profile page | F2b |
| `errors` | one key per `ErrorCode` | F2a |
| `validation` | zod error-map keys | F2a |
| `emails` | invite + reset mail texts | F2a |
| `notificationItems` | rendered texts for every notification type incl. `eventRemoved` (used by triggers in many units) | F2a |
| `org` | departments, teams, job roles admin | W1-org |
| `users` | user admin (list, form, invite, deactivate, delete) | W1-org |
| `library` | library, page view, admin library management | W1-content |
| `editor` | editor UI, lock banners, idle dialog, image upload | W1-content |
| `notifications` | bell, notifications page | W1-notify-events |
| `events` | events page + admin | W1-notify-events |
| `templates` | template admin | W2-templates |
| `plan` | plan view, employee detail, assignment, completion, badges | W2-plans |
| `dashboard` | team overview, admin overview | W3-dashboards |
| `search` | search page | W3-search |

Phase labels are fixed by K§5 and must be used verbatim (`enums.phase.*`):

| key | de | en |
|---|---|---|
| `before_start` | Vor dem Start | Before start |
| `first_day` | Erster Tag | First day |
| `first_week` | Erste Woche | First week |
| `first_month` | Erster Monat | First month |

Other K-fixed wordings and their keys: `common.germanOnly` (de "Nur auf Deutsch verfügbar", en "Only available in
German"), `plan.empty` (de "Dein Onboarding-Plan wird vorbereitet"), `plan.updatedSinceCompletion` (de "Seit deinem
Abschluss aktualisiert"), `editor.lock.*` / `editor.idle.prompt` (§4.7), `notificationItems.eventRemoved` (de
"Veranstaltung entfernt").

F1 creates **all** files for both locales as `{}`. A unit edits only its own namespace files, always de **and** en.
A unit needing a generic string that is missing from a foundation namespace adds it to its own namespace instead
(small duplication is accepted). A unit test (`tests/unit/i18n/parity.test.ts`, F1) fails if de/en key sets differ.

---

## 8. Testing infrastructure

| Item | Decision |
|---|---|
| Runner | Vitest 5, `environment: "node"`. Two configs sharing `vitest.shared.ts` (alias `@` → `src`, alias `server-only` → `tests/setup/empty-module.ts`). |
| Unit | `vitest.config.ts`: `include: ["tests/unit/**/*.test.ts"]`, parallel, no DB. |
| Integration | `vitest.integration.config.ts`: `include: ["tests/integration/**/*.test.ts"]`, `globalSetup: tests/setup/global-setup.ts`, `setupFiles: tests/setup/integration-setup.ts`, `fileParallelism: false` (one worker, deterministic), `testTimeout: 20000`. Real PostgreSQL. |
| Scripts | `test:unit` = `vitest run`; `test:integration` = `vitest run -c vitest.integration.config.ts`; `test` = both. |
| Env | Configs first load `.env` with `process.loadEnvFile()` only if the file exists (CI has no `.env`, it sets env vars), **then** force `NODE_ENV=test` and `MAIL_TRANSPORT=memory` (overriding whatever `.env` says). Engineers never `cat` `.env`. |

**Per-worktree test database** (`tests/setup/test-db.ts`):

```ts
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = new URL(process.env.DATABASE_URL!);                 // dev DB url (localhost:5433)
  const dir = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
  const hash = createHash("sha1").update(process.cwd()).digest("hex").slice(0, 8);
  base.pathname = `/onboarding_test_${dir}_${hash}`;               // ≤ 63 chars, unique per checkout path
  return base.toString();
}
```

- `global-setup.ts`: connects to the maintenance DB `postgres` on the same server, `DROP DATABASE IF EXISTS <name> WITH (FORCE)`, `CREATE DATABASE <name>`, runs drizzle `migrate()` from `drizzle/`. Teardown leaves the DB (fast re-runs; dropped on next run).
- `integration-setup.ts`: sets `process.env.DATABASE_URL = testDatabaseUrl()` and `process.env.UPLOAD_DIR` to a
  per-run temp dir (`fs.mkdtemp(os.tmpdir() + "/onboarding-uploads-")`, removed in `afterAll`) before any app module
  is imported, so upload tests never write into the shared `./uploads`;
  `beforeEach` ⇒ `resetDb()` (TRUNCATE all app tables `RESTART IDENTITY CASCADE`, list generated from schema) and
  `clearOutbox()`; `afterAll` ⇒ `closeDb()`.
- Factories `tests/factories/index.ts` (F1, direct Drizzle, sensible defaults, every field overridable):
  `createDepartment, createTeam, createJobRole, createUser({ role, leadId, teamId, … }), createAdmin, createLead, createEmployee (creates org + lead if missing), createModule, createPage({ status, titleDe, contentDe, … }), createTemplate({ steps: [{ pageId, phase }] }), assignPlanSteps(userId, [{ pageId, phase }]), completePage(userId, pageId, at?), createEvent, createNotification, createLock({ pageId, userId, expiresAt })`.
- Helpers `tests/helpers/`: `actorOf(userRow): Actor`, `db.ts` (`resetDb`, raw `testDb`), `time.ts` (`expireLock(pageId)`, `minutesAgo(n)`), `tiptap.ts` (`doc("text")` builder).
- Each unit puts tests in `tests/unit/<unit-dir>/` and `tests/integration/<unit-dir>/` (see §12). Mandatory
  integration coverage (K§11): progress, assignment/snapshot/dedupe, lock (acquire/heartbeat/expiry/takeover/save
  rejection), notification dedupe, authorization per service.
- **Playwright** (F1 scaffold only): `playwright.config.ts` (`testDir: tests/e2e`, chromium only, port from
  `process.env.E2E_PORT ?? 3000`, `webServer: { command: "pnpm dev", env: { PORT } }`, `reuseExistingServer: false`
  so it never silently tests another worktree's server, baseURL `http://localhost:${port}`), one smoke test (`/login`
  renders). Parallel worktrees run the dev server with `PORT=<n> APP_URL=http://localhost:<n> pnpm dev` (both together,
  otherwise Better Auth's origin check rejects requests); F1 writes this as a comment in `.env.example`, W3-delivery
  repeats it in `docs/runbook.md`.
  `pnpm test:e2e`. Not part of `pnpm test` nor default CI; separate manual workflow. Run rarely (K§11).

---

## 9. Env and configuration

### 9.1 `.env.example` (committed, non-secret local defaults)

```dotenv
# App
# Worktrees: run `PORT=<n> APP_URL=http://localhost:<n> pnpm dev` (port and APP_URL must match).
# NODE_ENV is intentionally absent: Next sets it; tests force NODE_ENV=test.
APP_URL=http://localhost:3000
LOG_LEVEL=info

# Database (docker compose dev: host port 5433)
DATABASE_URL=postgres://onboarding:onboarding@localhost:5433/onboarding

# Better Auth — generated locally by `pnpm setup:env`, never commit a real value
BETTER_AUTH_SECRET=

# Mail (Mailpit locally: UI http://localhost:8025)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM="Onboarding Portal <noreply@example.com>"
MAIL_TRANSPORT=smtp

# Uploads (local disk StorageAdapter)
UPLOAD_DIR=./uploads

# Optional, non-interactive seed:admin (CI/E2E only)
# SEED_ADMIN_EMAIL=
# SEED_ADMIN_PASSWORD=
```

`.env.prod.example` (W3-delivery) adds `POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB` for `docker-compose.prod.yml`.
F1 adds `!.env.prod.example` to `.gitignore`.

### 9.2 `scripts/setup-env.ts` (`pnpm setup:env`, F1)

If `.env` exists: print "exists, not touched" and exit 0 (never read or overwrite it). Otherwise read `.env.example`,
replace the `BETTER_AUTH_SECRET=` line with a fresh `randomBytes(32).toString("base64url")`, write `.env` with mode
0600, print only "created .env". The secret is never printed.

### 9.3 `src/config/env.ts` (F1)

Zod schema over `process.env`, parsed lazily on first access (`getEnv()` / `env` getter) so tests can set variables
first. Required in non-test: `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥ 32 chars), `APP_URL`; others defaulted as in
`.env.example`. Never logs values.

### 9.4 `src/config/app.ts` (F1)

Sectioned, `as const`. Every value in K§2 plus enum value arrays, routes, navigation and route access.

```ts
export const APP_CONFIG = {
  appName: "Onboarding Portal",                    // K§9: name + logo from one place
  logoPath: "/logo.svg",
  auth: {
    passwordMinLength: 12, passwordMaxLength: 128,
    sessionExpiresInSeconds: 7 * 24 * 60 * 60, sessionUpdateAgeSeconds: 24 * 60 * 60,
    inviteTokenTtlHours: 72, resetPasswordTokenTtlSeconds: 60 * 60,
    rateLimit: { windowSeconds: 60, max: 100, signInMax: 5, passwordResetMax: 3 },
  },
  i18n: { locales: ["de", "en"], defaultLocale: "de", localeCookie: "NEXT_LOCALE", timeZone: "Europe/Berlin" },
  theme: { values: ["light", "dark", "system"], default: "system" },
  notifications: { pollIntervalMs: 60_000, retentionDays: 90, bellPreviewLimit: 8, pageSize: 20 },
  locks: { heartbeatIntervalMs: 30_000, leaseDurationSeconds: 120, idleTimeoutMs: 15 * 60_000, idlePromptGraceMs: 60_000 },
  uploads: { allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"], maxBytes: 5 * 1024 * 1024, urlPrefix: "/api/uploads/" },
  search: { minQueryLength: 2, maxResults: 20 },
  archivedUserDeletionSuggestionMonths: 6,
  draftStorageKeyPrefix: "onboarding-portal:page-draft:",
} as const;

export const ROLES = ["admin", "team_lead", "employee"] as const;
export const ONBOARDING_STATUSES = ["active", "completed", "archived"] as const;
export const PAGE_STATUSES = ["draft", "published", "archived"] as const;
export const TEMPLATE_STATUSES = ["active", "archived"] as const;
export const PHASES = ["before_start", "first_day", "first_week", "first_month"] as const;
export const NOTIFICATION_TYPES = ["step_added", "page_updated", "event_announced", "employee_assigned", "onboarding_completed"] as const;
export const ROUTES = { /* §6 */ } as const;
export const ROUTE_ACCESS = [ { prefix: "/admin", roles: ["admin"] }, { prefix: "/team", roles: ["team_lead", "admin"] }, { prefix: "/library", roles: ["team_lead", "admin"] } ] as const;
export const NAVIGATION = [ /* §6 */ ] as const;

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
```

Each block has explicit start/end markers and one blank line between blocks (Prettier collapses more). Units edit
only strictly **between** their own markers, so any two units' changes are always separated by at least three
unchanged lines (`// <<< A`, blank, `// >>> B`) and git merges them cleanly in any order. A unit only replaces the
`{}` of its own exported object (`W1_ORG_CONFIG`, …). F1 places all markers and formats the file once; units run
Prettier only on files they own (`prettier --write <own paths>`) — running it on `app.ts` changes nothing outside
their block because F1 already formatted it.

`APP_CONFIG.auth` additionally holds `disabledPaths` (the list in §5.3) and `rateLimit.customRules` values.

---

## 10. Dependencies

Verified with `npm view` on 2026-11-15. F1 installs **everything** below with exact versions (`pnpm add -E`) so later
units never touch `package.json` / `pnpm-lock.yaml`. `packageManager: "pnpm@12.14.0"`, `engines.node: ">=24 <25"`.

Runtime (`dependencies`)

| Package | Version | Use |
|---|---|---|
| next | 16.4.6 | framework |
| react, react-dom | 19.3.1 | |
| better-auth | 1.7.25 | auth (+ `better-auth/plugins/admin`, `/adapters/drizzle`, `/crypto`, `/cookies`, `/next-js`, `/react`) |
| drizzle-orm | 0.45.4 | ORM (0.45 is `latest`; 1.0 still rc) |
| pg | 8.23.1 | Postgres driver |
| next-intl | 4.15.1 | i18n |
| zod | 4.6.7 | validation |
| @tiptap/core, @tiptap/pm, @tiptap/react, @tiptap/starter-kit, @tiptap/extension-image, @tiptap/extensions, @tiptap/static-renderer | 3.34.0 | editor (StarterKit incl. Link/Underline; Placeholder + CharacterCount from `@tiptap/extensions`; server rendering of JSON via static-renderer) |
| nodemailer | 10.6.0 | SMTP |
| react-email | 6.11.13 | email components **and** `render` (the old `@react-email/components` is deprecated) |
| pino | 10.4.0 | logging |
| next-themes | 0.4.6 | light/dark/system |
| radix-ui | 1.8.1 | shadcn primitives |
| class-variance-authority | 0.7.1 | shadcn |
| clsx | 2.1.1 | shadcn |
| tailwind-merge | 3.7.0 | shadcn |
| lucide-react | 1.73.0 | icons |
| sonner | 2.0.8 | toasts |
| date-fns | 4.4.0 | date helpers |
| @date-fns/tz | 1.5.0 | Europe/Berlin conversion |
| file-type | 22.3.0 | upload magic-byte detection |
| server-only | 0.0.1 | server module guard (throws outside `react-server`; Vitest alias + script shim, §1) |

Dev (`devDependencies`)

| Package | Version | Note |
|---|---|---|
| typescript | 6.0.3 | **not 7.x**: `typescript-eslint` (via eslint-config-next) supports `<6.1.0`. TS 6 changed defaults (`types` defaults to `[]`, `noUncheckedSideEffectImports`, `rootDir`): F1 sets `"types": ["node"]` explicitly and confirms `tsc --noEmit` passes with CSS side-effect imports |
| @types/node | 24.19.2 | Node 24 |
| @types/react, @types/react-dom | 19.3.0 | |
| @types/pg | 8.23.1 | |
| @types/nodemailer | 8.0.2 | |
| drizzle-kit | 0.31.11 | migrations |
| tailwindcss, @tailwindcss/postcss | 4.3.5 | |
| tw-animate-css | 1.4.0 | shadcn animations |
| eslint | 9.39.5 | **not 10.x**: eslint-plugin-react / jsx-a11y / import peer ranges end at ^9 |
| eslint-config-next | 16.4.6 | flat config |
| eslint-config-prettier | 10.1.8 | |
| prettier | 3.10.1 | |
| prettier-plugin-tailwindcss | 0.8.1 | |
| vitest, @vitest/coverage-v8 | 5.1.0 | |
| vite | 8.3.8 | required peer of vitest 5 |
| @playwright/test | 1.65.1 | |
| tsx | 4.23.15 | scripts |
| @inquirer/prompts | 8.8.0 | hidden password prompt in `seed:admin` |
| pino-pretty | 13.2.0 | dev log formatting |

shadcn CLI is run once by F1 via `pnpm dlx shadcn@4.23.0` (not installed). F1 adds these components to
`src/components/ui/`: `alert, alert-dialog, avatar, badge, button, card, checkbox, dialog, dropdown-menu, input,
label, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs,
textarea, tooltip`. The CSS variables shadcn writes are moved into `src/styles/tokens.css`; `globals.css` only imports
Tailwind, `tw-animate-css` and `tokens.css` and maps tokens via `@theme inline`. Units do not add packages or shadcn
components; if one is truly needed, it is a contract change request (§13).

pnpm 12 blocks dependency build scripts by default: `pnpm-workspace.yaml` (F1) allows only `esbuild` (`allowBuilds`) and denies `@parcel/watcher` and `@swc/core`. `env.ts` supplies a fixed dummy `BETTER_AUTH_SECRET` only when `NODE_ENV=test`.

Not used (by decision): react-hook-form, drag-and-drop libs, dotenv (Node `process.loadEnvFile`), sharp, faker
(demo data is hand-written fictional content), any external error tracker.

---

## 11. Foundation (F1, F2a, F2b)

Order: **F1 → (F2a ∥ F2b)**. F2a and F2b run in parallel. So that F2b can sign in and test every `(app)` route while
F2a is still working, **F1 ships a working minimal auth** (Better Auth config, `/api/auth`, actor, guards,
`runAction`, `bootstrap.createInitialAdmin`, `seed:admin`). F1 also creates typed **contract stubs** with final
signatures for the F2a modules F2b calls (`invitations.verifyInvitationToken/acceptInvitation`, `reset-mail.ts`); F2a
replaces only those bodies. F2a and F2b never edit the same file. (Deviations from the original split: the i18n
request config and the auth core moved to F1, because `next.config.ts`, every namespace file and the sign-in path are
needed by both parallel units.)

**`package.json`, `pnpm-lock.yaml` and the shadcn component set are frozen once F1 is merged** — F2a and F2b do not
`pnpm add` anything either (contract change request, §13).

### F1 — scaffold, tooling, schema, working auth core, tests

Creates/owns:
- `package.json` (all deps from §10, scripts below), `pnpm-lock.yaml`, `tsconfig.json` (strict,
  `noUncheckedIndexedAccess`, paths, `"types": ["node"]`, **committed exactly as Next rewrites it**: F1 runs `next dev`
  and `next build` once and commits the resulting tsconfig incl. the `.next/types/**/*.ts` / `.next/dev/types/**/*.ts`
  includes), `next.config.ts` (`output: "standalone"`, next-intl plugin,
  `serverExternalPackages: ["pino", "pino-pretty"]`, security headers: CSP `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev) `; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`), `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `.nvmrc` (24), `.gitignore` (+ `!.env.prod.example`, `next-env.d.ts` (regenerated by Next, differs between dev and build), `uploads/`, `*.tsbuildinfo`, `test-results/`, `playwright-report/`).
- `docker-compose.yml`: `postgres:18.7-alpine` (tag verified to exist on Docker Hub, 2026-11-15; `5433:5432`,
  user/password/db `onboarding`, **`volumes: ["pgdata:/var/lib/postgresql"]`** — PostgreSQL 18 images keep PGDATA at
  `/var/lib/postgresql/18/docker` and refuse/lose a mount at the old `/var/lib/postgresql/data`; no `PGDATA`
  override; healthcheck `pg_isready`), `axllent/mailpit:v1.33.1` (`1025`, `8025`). The same postgres tag is used in
  `ci.yml` and `docker-compose.prod.yml`.
- `.env.example`, `scripts/setup-env.ts`, `scripts/db-migrate.ts` (programmatic migrate, used in prod tools image),
  `scripts/lib/load-env.ts`, **`scripts/lib/server-only-shim.mjs`** (§1), `scripts/seed-admin.ts` (prompts email,
  names, hidden password twice; or `SEED_ADMIN_*` env non-interactively; never echoes the password; `--help`),
  `scripts/seed-demo.ts` (stub printing "not implemented", owned later by W3-delivery), `drizzle.config.ts`.
- `src/server/db/**` complete (§2), `drizzle/0000_initial.sql` + meta (generated, then reviewed: generated columns,
  partial indexes, checks present).
- `src/config/app.ts` (§9.4 complete incl. all unit markers), `src/config/env.ts`, `src/server/errors.ts` (incl.
  `rethrowDbError`), `src/server/logger.ts`, `src/lib/utils.ts` (`cn`), `src/lib/domain/page-status.ts`,
  `src/lib/domain/onboarding-status.ts`, `src/lib/domain/locale-content.ts` (`hasEnglish`, `hasEnglishEvent`,
  `isEmptyDoc`), `src/server/auth/types.ts`, `src/server/auth/permissions.ts`, `src/lib/auth-client.ts`.
- **Working auth core:** `src/server/auth/auth.ts` (§5.3 complete: drizzle adapter, admin plugin, `nextCookies`,
  `disabledPaths`, rate limits), `src/server/auth/reset-mail.ts` (**stub** exporting `sendResetPassword` that only
  logs "reset mail not implemented"; F2a fills it), `src/server/auth/actor.ts`, `src/server/auth/guards.ts`,
  `src/server/actions/run-action.ts`, `src/lib/action-result.ts`, `src/app/api/auth/[...all]/route.ts`,
  `src/server/services/bootstrap.ts`, `src/server/services/health.ts`.
- Contract stubs (bodies throw `new Error("not implemented: F2a")`): `src/server/services/invitations.ts`
  (`verifyInvitationToken`, `acceptInvitation` signatures).
- `src/styles/tokens.css` (neutral palette, light + `.dark`), `src/app/globals.css`, `src/components/ui/**` (shadcn
  list), minimal `src/app/layout.tsx` + `src/app/page.tsx` (replaced by F2b), `src/app/api/health/route.ts`,
  `public/logo.svg` (neutral placeholder).
- i18n: `src/i18n/{namespaces,messages,locale,request}.ts`, `src/types/next-intl.d.ts`,
  `messages/{de,en}/<every namespace>.json` = `{}`.
- Tests: `vitest.shared.ts`, `vitest.config.ts`, `vitest.integration.config.ts`, `tests/setup/**`, `tests/helpers/**`,
  `tests/factories/**`, unit tests for both state machines, `locale-content`, `permissions` (incl. `canAccessRoute`),
  i18n parity and no-wrapper, integration tests `tests/integration/foundation/schema.test.ts` (generated tsvector
  populated, notification partial unique index works, page_edit_locks PK, EN all-or-nothing CHECKs) and
  `tests/integration/foundation/auth.test.ts` (seeded admin signs in via `auth.api.signInEmail`; disabled endpoints
  answer 404 and the endpoint enumeration check, §5.3; banned user cannot sign in; deleting sessions invalidates
  `getSession`).
- `playwright.config.ts`, `tests/e2e/smoke.spec.ts`.
- `.github/workflows/ci.yml` (push/PR: pnpm install --frozen-lockfile, lint, typecheck, test:unit, test:integration
  with `postgres:18.7-alpine` service on 5432 and env `DATABASE_URL`, build with dummy `BETTER_AUTH_SECRET`),
  `.github/workflows/e2e.yml` (`workflow_dispatch` only).

`package.json` scripts: `dev, build, start, lint (eslint .), typecheck (next typegen && tsc --noEmit), format,
format:check, test, test:unit, test:integration, test:e2e, db:generate, db:migrate, db:studio, setup:env, seed:admin,
seed:demo`. (`next lint` no longer exists in Next 16; `next typegen` creates the route/PageProps types so `tsc` passes
before any build, e.g. in CI.) Every script that runs TS under Node uses
`tsx --import ./scripts/lib/server-only-shim.mjs scripts/<x>.ts`.

**Acceptance F1:** `pnpm setup:env` creates `.env` without printing the secret; `docker compose up -d` healthy;
restart the postgres container ⇒ data still present; `pnpm db:migrate` applies `0000_initial`; `pnpm db:generate`
reports no changes (schema loads in drizzle-kit, relative imports); `pnpm seed:admin --help` loads without throwing
(server-only shim works) and `pnpm seed:admin` creates an admin who can sign in at `/api/auth/sign-in/email`, second
run with the same email fails cleanly; `pnpm dev` serves `/` and `/api/health`; `pnpm lint && pnpm typecheck &&
pnpm test && pnpm build` pass locally and in CI; **after dev + build + test, `git status --porcelain` is empty** (no
generated file dirties the tree); two checkouts in different directories run `pnpm test:integration` at the same time
without interfering (different DB names printed by global setup); no `.env` committed.

### F2a — invitations, mail, notifications core, shared service helpers

Creates/owns: `src/server/auth/reset-mail.ts` (implement, §5.3 rule), `src/server/http/route.ts`,
`src/server/mail/**`, `src/server/services/{invitations,notifications-core,notifications,row-locks,visibility,plan-hooks}.ts`,
`src/lib/domain/notification-params.ts` (`resolveNotificationParams`: `titleDe`/`titleEn` → `title` by viewer locale before `t(messageKey, params)`)
(plan-hooks as documented no-op stub), `src/lib/validation/common.ts`, messages `errors`, `validation`, `emails`,
`notificationItems` (de + en), the `F2a` block in `app.ts`, tests in `tests/integration/auth/**`,
`tests/integration/notifications-core/**`, `tests/integration/visibility/**`, `tests/unit/auth/**`. F2a does **not**
edit `auth.ts`, `actor.ts`, `guards.ts` or `run-action.ts` (F1, frozen).

**Acceptance F2a:**
- Integration: invitation issue → token valid 72 h → accept sets a password Better Auth accepts (`auth.api.signInEmail` succeeds), second accept fails `INVITE_INVALID`, expired token fails `INVITE_EXPIRED`, resend revokes the old token; invite mail captured in outbox with the set-password link and the TTL from config.
- Integration: `auth.api.requestPasswordReset` sends a localized reset mail to a user with a password; verification row expires in 1 h; banned user gets no mail; **a user without a credential password (invite pending or expired) gets no mail**; `getInvitationState` is `"accepted"` once a credential password exists.
- Integration: an `employee`/`team_lead` actor calling an admin-only service path gets `FORBIDDEN` (`resendInvitation`); unit: `canAccessRoute` for all prefixes.
- Integration: notifications core — dedupe updates `occurred_at`/params of the unread row and creates a new row after read; bulk insert; link/messageKey derived per type; **duplicate `(userId, dedupeKey)` inputs in one bulk call produce one row and no error**; `onboardingCompletedRecipientsInTx` with a lead who is also an admin returns that admin once, excludes the subject and archived leads.
- Integration: `visibility` — employee sees only published pages in own plan; lead sees published only; admin sees draft + published, archived only with `includeArchived`; `canViewPageInTx` and `visiblePagesCondition` agree on the same fixture.
- Manual: invite mail visible in Mailpit (http://localhost:8025) with working link (verified together with F2b after merge).

### F2b — app shell and public auth pages

Creates/owns: `src/app/layout.tsx` (html `lang`, `NextIntlClientProvider`, `ThemeProvider` with `attribute="class"`,
default from actor theme, `Toaster`), `src/app/page.tsx` removed in favour of `src/app/(app)/page.tsx` (role
redirect), `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/(auth)/**`, `src/app/(app)/layout.tsx`,
`src/app/(app)/error.tsx`, `loading.tsx` in each of `src/app/(app)/{plan,events,search,notifications,profile,pages,team,library,admin}/` (not one `(app)/loading.tsx`: a Suspense boundary above the guard layouts would stream a 200 before `notFound()`/`redirect()` run, so employees would get 200 instead of 404 on admin routes), `src/app/(app)/{team,library,admin}/layout.tsx` (guards),
`src/app/(app)/profile/**`, **placeholder `page.tsx` for every route in §6** (renders `<PlaceholderPage titleKey=…>`),
`src/proxy.ts`, `src/components/layout/**` (app-shell, sidebar-nav, mobile-nav, top-bar, user-menu, theme-switcher,
locale-switcher, nav-icons, placeholder-page), `src/components/common/**` (empty-state, error-state, loading-state,
confirm-dialog (simple + type-to-confirm), page-header, progress-bar, status-badge, form-field, submit-button,
date-time display), stub `src/components/notifications/notification-bell.tsx` (bell icon linking to
`/notifications`, no count — owned later by W1-notify-events), stub `src/components/plan/plan-step-actions.tsx`
(`export async function PlanStepActions({ pageId }: { pageId: string }) { return null; }` — owned later by W2-plans),
`src/server/services/profile.ts`, `src/server/actions/preferences.ts` (`setLocaleAction` public: cookie + profile when signed in; `setThemeAction`), `src/lib/validation/profile.ts`, `src/lib/datetime.ts`, `src/lib/navigation.ts` (role filter, `homeRouteFor`, `safeNextPath`), `src/components/layout/{theme-provider,auth-card}.tsx`, `src/components/common/use-message.ts`, messages `common`, `enums`,
`nav`, `auth`, `profile` (de + en), the `F2b` block in `app.ts`, tests `tests/integration/profile/**`,
`tests/unit/layout/**`.

**Acceptance F2b** (testable before merge with F1's `seed:admin` + factories; set-password needs F2a and is
re-checked after merge): sign-in, sign-out, wrong password message, deactivated message; **stale-cookie test:
deactivate a user while their cookie is still present, then load `/login` ⇒ it renders, no redirect loop**; every
route in §6 renders its placeholder for allowed roles and 404s for others; nav shows exactly the entries for the role;
theme light/dark/system persists to profile and survives reload; DE/EN switch works signed out (cookie) and signed in
(profile); layout usable at 375 px width; no hard-coded UI text or colors (lint/grep check); `pnpm lint && pnpm
typecheck && pnpm test && pnpm build` green.

**Files the foundation creates as stubs or shared slots for later units (complete list):**
placeholder `page.tsx` for every route in §6; `notification-bell.tsx`; `plan-step-actions.tsx`;
`src/server/services/plan-hooks.ts`; `scripts/seed-demo.ts`; empty `messages/{de,en}/<ns>.json` for every namespace;
unit blocks in `src/config/app.ts`; `NAVIGATION` and `ROUTES` with every entry; the complete schema + migration;
all factories; all shadcn components; all error codes and their messages; `notificationItems` texts for every type.

---

## 12. Work breakdown after the foundation

Every unit: own worktree + branch from up-to-date `main`; owns exactly the paths listed (a folder entry includes
everything below it); replaces the placeholder files it owns; may **import** (never edit) foundation modules and
modules of already-merged earlier-wave units; tests in its own test directories; messages only in its own namespace
files; constants only in its own `app.ts` block. Done = unit acceptance + `pnpm lint && pnpm typecheck && pnpm test &&
pnpm build` green. Mandatory integration tests as listed.

### Wave 1 (parallel)

**W1-org** — K Phase 2
- Owns: `src/app/(app)/admin/users/**`, `src/app/(app)/admin/org/**`, `src/app/(app)/admin/job-roles/**`,
  `src/server/services/{org,users}.ts`, `src/lib/validation/{org,users}.ts`, `src/components/org/**`,
  `messages/{de,en}/{org,users}.json`, `tests/{unit,integration}/org/**`, `tests/{unit,integration}/users/**`.
- Uses: `invitations.issueInvitationInTx/sendInvitationEmail/resendInvitation/getInvitationState`,
  `notifications-core` (`employee_assigned` on create and lead change), `planHooks.recomputeOnboardingStatusInTx`,
  `applyOnboardingEvent`.
- Acceptance: CRUD + deletion rules with usage lists (integration), incl. department with only empty teams ⇒ deleted
  together with them, and `updateTeam` department change rejected while templates reference the team; unique email
  incl. case (integration); create user sends invite (outbox) and notifies lead (not when the actor names themselves
  as lead); lead change notifies new lead; lead validation only on change, cycle rejected; deactivate ⇒ sessions
  deleted, sign-in refused, status archived, impact lists led employees; reactivate; permanent delete only from
  archived, blocked while leading others, **removes every notification whose `subject_user_id` is the deleted user**
  (other users' feeds); role change to `employee` blocked while leading, admin → team_lead allowed; last-admin
  protection incl. two concurrent deactivations of the last two admins (`Promise.all`, exactly one succeeds);
  non-admin gets `FORBIDDEN` on every service.

**W1-content** — K Phase 3
- Owns: `src/app/(app)/library/**` (except `layout.tsx`, F2b), `src/app/(app)/pages/**`,
  `src/app/(app)/admin/library/**`, `src/app/api/uploads/**`, `src/app/api/locks/**`,
  `src/server/services/{modules,pages,locks,uploads}.ts`, `src/server/storage/**` (`storage-adapter.ts` interface
  `put/get/delete`, `local-disk-storage.ts` under `env.UPLOAD_DIR`, path-traversal safe, `index.ts getStorage()`),
  `src/lib/tiptap/**` (shared extension list, JSON sanitizer: allowed nodes/marks, links only `http(s):`/`mailto:`,
  images only `APP_CONFIG.uploads.urlPrefix`, `extract-text.ts`), `src/lib/validation/content.ts`,
  `src/components/editor/**`, `src/components/content/**` (page renderer via `@tiptap/static-renderer`),
  `messages/{de,en}/{library,editor}.json`, `tests/{unit,integration}/content/**`.
- Calls `planHooks.onPublishedPageContentChanged` / `onPageStatusChanged` in its transactions; renders
  `<PlanStepActions pageId>` on the page view.
- Visibility only through `visibility.ts` (F2a); no own copy of the rule in pages/uploads.
- Acceptance: lock acquire (missing page ⇒ `NOT_FOUND`) / heartbeat (own expired-but-free lock is renewed;
  someone else's lock ⇒ `held:false` with holder) / expiry / takeover (resets `acquired_at`) / save rejection
  (integration); page state machine; delete-or-archive rule with **used ⇔ template step OR plan step (any user status)
  OR completion**, one test each for template-only, archived-user-plan-only and completion-only ⇒ archived, unused ⇒
  hard-deleted; text extraction + tsvector filled; EN fallback via `hasEnglish` (EN title without EN content rejected by
  zod; all-null normalisation); "last edited" = `content_updated_at` + `updated_by` (unchanged by a move); image: admin
  upload ok, wrong type / >5 MB rejected, unauthenticated 401, employee without the page in plan 404 (integration on
  service + route wrapper), **content referencing another page's upload id (or a `page_id IS NULL` upload) rejected
  with `editor.errors.foreignImage`**; employee cannot view draft or not-in-plan page; leads see only published, also
  when passing `status: "draft"` to `listLibrary`.

**W1-notify-events** — K Phase 5
- Owns: `src/app/(app)/notifications/**`, `src/app/(app)/events/**`, `src/app/(app)/admin/events/**`,
  `src/app/api/notifications/**`, `src/server/services/{notifications,events}.ts`,
  `src/lib/validation/{notifications,events}.ts`, `src/components/notifications/**` (replaces the bell stub: unread
  badge, dropdown with latest, mark read / all read, polling hook), `src/components/events/**`,
  `messages/{de,en}/{notifications,events}.json`, `tests/{unit,integration}/notifications/**`,
  `tests/{unit,integration}/events/**`.
- Acceptance: list/unread/markRead/markAll only own rows; keyset pagination over rows with equal `occurred_at`
  neither skips nor duplicates; 90-day purge on read; announce reaches all non-archived users and dedupes while
  unread; deleting an event renders "removed" with link `ROUTES.events` (no anchor); event EN both-or-none (zod +
  CHECK); upcoming/past split; non-admin `FORBIDDEN` on CRUD/announce.

### Wave 2 (parallel, after Wave 1 merged)

**W2-templates** — K Phase 4 (template side)
- Owns: `src/app/(app)/admin/templates/**`, `src/server/services/templates.ts`, `src/lib/validation/templates.ts`,
  `src/components/templates/**`, `messages/{de,en}/templates.json`, `tests/{unit,integration}/templates/**`.
- Acceptance: department required — a missing `departmentId` is `VALIDATION`, `"all"` ⇒ company-wide (null) —
  team must belong to department, optional job role; steps add / remove / reorder / phase change; duplicate page in a
  template rejected; archived page cannot be added; delete unused vs archive used; archived templates hidden from
  assignment (verified via data, not plans code); admin only.

**W2-plans** — K Phase 4 (plan side) + notification triggers
- Owns: `src/app/(app)/plan/**`, `src/app/(app)/team/[userId]/**`, `src/server/services/{plans,plan-hooks}.ts`,
  `src/lib/domain/progress.ts`, `src/lib/validation/plans.ts`, `src/components/plan/**` (incl. replacing
  `plan-step-actions.tsx`: "Erledigt" toggle + "Seit deinem Abschluss aktualisiert" badge),
  `messages/{de,en}/plan.json`, `tests/{unit,integration}/plans/**`.
- Acceptance (integration): snapshot copies steps, later template edits don't change plans, dedupe across templates,
  archived pages skipped, archived template in the selection ⇒ `VALIDATION`, draft-only new steps ⇒ no `step_added`;
  suggestions match dept/team/role rule; **matrix "team_lead on a foreign employee ⇒ `NOT_FOUND`" for
  `getPlanForUser`, `listAssignableTemplates`, `listAddablePages`, `assignTemplates`, `addPlanStep`,
  `removePlanStep`**; `addPlanStep` with a draft/archived page ⇒ `VALIDATION`; lead sees draft steps only as a flag
  without title; add/remove step keeps completions; progress excludes draft/archived pages; status machine incl.
  completed→active on new step/undo and completion notifications to lead + admins every time; **lead who is also an
  admin: the employee completes the last step ⇒ no error, exactly one notification for that admin**; the subject
  (admin/lead with own plan) gets no notification about themselves; **two concurrent `setStepCompletion` calls on the
  last two open steps (`Promise.all`) ⇒ status `completed` and the notifications sent**; reactivating a user whose
  plan is 100 % ⇒ `completed` without `onboarding_completed` notification; `page_updated` sent only to
  active/completed plan holders, deduped while unread, not to actor; employee sees "wird vorbereitet" for empty plan;
  completion only for own plan.

### Wave 3 (parallel, after Wave 2 merged)

**W3-dashboards** — K Phase 6
- Owns: `src/app/(app)/team/page.tsx` (+ `src/app/(app)/team/_components/**`), `src/app/(app)/admin/page.tsx`,
  `src/server/services/dashboards.ts`, `src/lib/validation/dashboards.ts`, `src/components/dashboard/**`,
  `messages/{de,en}/dashboard.json`, `tests/{unit,integration}/dashboards/**`.
- Acceptance: lead sees only own employees (integration); admin filters by department/team/status; progress and last
  activity match `plans` numbers; empty states.

**W3-search** — K Phase 6
- Owns: `src/app/(app)/search/**`, `src/server/services/search.ts`, `src/lib/validation/search.ts`,
  `src/components/search/**`, `messages/{de,en}/search.json`, `tests/{unit,integration}/search/**`.
- Visibility only via `visiblePagesCondition` (F2a).
- Acceptance (integration): employee never gets pages outside own published plan; lead never gets drafts; German
  stemming works (e.g. "Urlaubs" finds "Urlaub"); EN users search EN text where available (`hasEnglish`), DE
  otherwise; events found by title/description for all roles, `%`/`_` in the query are literal; snippet highlighting
  without HTML injection.

**W3-delivery** — K Phase 7 (delivery part)
- Owns: `scripts/seed-demo.ts`, `scripts/demo-data/**` (fictional only), `Dockerfile` (multi-stage: `deps`, `build`,
  `runner` = Next standalone, `tools` = full deps + source for `db:migrate`/`seed:*`, every command run as
  `tsx --import ./scripts/lib/server-only-shim.mjs …`), `.dockerignore`, `docker-compose.prod.yml` (app, postgres
  `postgres:18.7-alpine` with `pgdata:/var/lib/postgresql` (§11), one-shot `migrate`; uploads volume),
  `.env.prod.example`, `docs/runbook.md` (install, env, migrations, first admin, real SMTP switch, SPF/DKIM/DMARC check,
  backup note, worktree `PORT`/`APP_URL`, note that sessions keep IP/user agent only for security/rate limiting and
  are removed on sign-out/expiry/deactivation).
- Seed uses services (with a demo admin created through `bootstrap.createInitialAdmin`), sets passwords via
  `issueInvitationInTx` + `acceptInvitation`, edits pages through `acquireLock` + `savePageContent`. Idempotency:
  refuses to run if any user exists unless `--reset` on a non-production DB.
- Acceptance: `pnpm seed:demo` on an empty DB produces a usable demo (all roles, plans with partial progress, events);
  `docker compose -f docker-compose.prod.yml up` clean install works following the runbook.

### Wave 4

**W4-e2e-docs**
- Owns: `tests/e2e/**`, `playwright.config.ts`, `docs/projektdoku/**` (ER diagram in mermaid generated from §2,
  permission matrix from K§3, page + onboarding state diagrams, test plan and test report incl. integration test list,
  DSGVO note: only completion + date, no view logs, session IP/UA purpose and lifetime).
- E2E (few, K§11): login + plan completion; admin creates user + assigns template; event announcement reaches bell.
- Acceptance: E2E green once; docs consistent with code; `v1-plan.md` status updated by the orchestrator.

---

## 13. Merge and coordination rules

- **Frozen after F1** (also for F2a and F2b): `package.json`, `pnpm-lock.yaml`, the shadcn component set, and every
  file F1 owns (§11) — in particular `src/server/auth/{auth,actor,guards,types,permissions}.ts`,
  `src/server/actions/run-action.ts`, `src/app/api/auth/**`, `tsconfig.json`. Exceptions are the declared stubs F2a/F2b
  fill (`reset-mail.ts`, `invitations.ts`, `plan-hooks.ts`, placeholder pages, `src/app/layout.tsx`/`page.tsx`).
- **Frozen after the foundation** (no unit edits them): `package.json`, `pnpm-lock.yaml`, `next.config.ts`,
  `tsconfig.json`, `eslint.config.mjs`, `vitest*.ts`, `drizzle.config.ts`, `drizzle/**`, `src/server/db/**`,
  `src/config/env.ts`, `src/config/app.ts` (except the unit's own block), `src/styles/tokens.css`,
  `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx` and the guard layouts, `src/proxy.ts`,
  `src/components/{ui,layout,common}/**`, `src/i18n/**`, `src/types/**`, foundation namespace files, `src/server/{auth,actions,http,mail}/**`,
  `src/server/errors.ts`, `src/server/logger.ts`,
  `src/server/services/{notifications-core,invitations,bootstrap,profile,health,row-locks,visibility}.ts`,
  `src/lib/{domain/page-status,domain/onboarding-status,domain/locale-content,action-result,utils,datetime,auth-client}.ts`,
  `src/lib/validation/common.ts`, `scripts/{setup-env,db-migrate,seed-admin}.ts`, `scripts/lib/**`,
  `tests/{setup,helpers,factories}/**`, `.github/**`, `docker-compose.yml`, `.env.example`, `.gitignore`.
- **Contract change request:** when a unit needs a change in a frozen file (new column, new package, new shadcn
  component, new error code, new shared string), it stops that part, describes the exact change in its handoff, and
  the orchestrator applies it on `main` in a separate commit (schema changes as a new migration named with the unit id).
  Units then rebase/merge `main`.
- `docs/kararlar.md` and `docs/v1-plan.md` are edited only by the orchestrator; units report proposed "(otonom karar)"
  entries in their handoff.
- Merge order inside a wave is free (no shared files). Each unit merges `main` into its branch before handoff and
  re-runs the full check.
- Commits: one line, `type(scope): summary`, lowercase, imperative, no trailing period, no AI attribution. Never
  `reset --hard`, never force push, never rewrite history; units do not push.

---

## 14. Proposed `kararlar.md` §13 entries and review notes

### 14.1 Proposed otonom kararlar (orchestrator adds them to `kararlar.md` §13)

Units and this blueprint never edit `kararlar.md` (§13). The revision after review introduced these interpretations;
until the orchestrator records them, this section is their reference.

| id | Proposed entry | Blueprint |
|---|---|---|
| P1 | Onboarding `tamamlandı → aktif`, plandaki aktif adımların ilerlemesi %100'ün altına her düştüğünde olur (yeni adım, geri alma, sayfanın yayına alınması/geri alınması/yayından kaldırılması, planın boşalması); geri alıp yeniden tamamlamak bildirimi yeniden gönderir (okunmamışsa tekilleşir). | §3.2 |
| P2 | Arşivden yeniden aktive edilen kullanıcı `aktif` olur, ardından sessizce yeniden hesaplanır (plan %100 ise `tamamlandı`); bu geçiş "onboarding tamamlandı" bildirimi göndermez. | §3.2, §4.4 users |
| P3 | "Sayfa güncellendi" bildirimi sayfayı düzenleyen kişinin kendisine gitmez. | §4.5 |
| P4 | Başkalarının lideri olan kullanıcı deaktive edilebilir; onay ekranı bu çalışanları listeler, admin onları başka lidere atar. Arşivdeki kullanıcıya hiçbir bildirim yazılmaz; lider kuralı yalnızca lider değiştirilirken kontrol edilir. Lider zinciri döngü oluşturamaz. | §2.3, §4.4 users |
| P5 | Kişi kendisi hakkında bildirim almaz: "onboarding tamamlandı" konunun kendisine, "çalışan atandı" işlemi yapan admin kendini lider seçtiyse ona gitmez. Alıcılar küme olarak hesaplanır (lider aynı zamanda admin olabilir). | §4.8 |
| P6 | Departman "kullanılıyor" ⇔ ekiplerinde kişi ya da departmana/ekiplerine bağlı şablon var; yalnızca boş ekipleri olan departman, bu ekiplerle birlikte silinir. Şablonu olan ekibin departmanı değiştirilemez. | §2.3, §4.4 org |
| P7 | Sayfa "kullanılıyor" ⇔ bir şablon adımında, herhangi bir kullanıcının (arşiv dahil) planında veya bir tamamlama kaydında geçiyor. | §4.4 pages |
| P8 | Arama sayfaları (erişim kuralına göre) ve etkinlikleri (herkes) kapsar. | §4.4 search |
| P9 | "Şifremi unuttum" maili yalnızca şifresi olan (daveti kabul etmiş) aktif kullanıcıya gider; süresi dolmuş davet yalnızca "daveti yeniden gönder" ile çözülür. | §5.3 |
| P10 | Bir görsel yalnızca yüklendiği sayfada kullanılabilir; başka sayfanın görseli içerikte reddedilir. | §2.3 uploads |
| P11 | Ekip lideri, çalışanın planındaki yayında olmayan adımları başlıksız, yalnızca durum etiketiyle görür. | §4.4 plans |
| P12 | Better Auth `admin` plugin yalnızca girişteki ban kontrolü için kullanılır; tüm `/admin/*` uçları ve `update-user`, `delete-user`, `change-email` gibi servisleri atlayan uçlar kapalıdır (404). | §5.3 |
| P13 | Sayfadaki "son düzenleyen + tarih" yalnızca içerik kaydını yansıtır (`content_updated_at` + `updated_by`); sıralama/durum değişiklikleri bu tarihi değiştirmez. | §2.3 pages |
| P14 | Kalıcı silinen kullanıcı hakkındaki bildirimler (liderin/adminlerin akışında) de silinir (DSGVO). | §2.3, §4.4 users |
| P15 | EN başlık ve EN içerik birlikte doldurulur ya da birlikte boş bırakılır (sayfa ve etkinlik); EN "var" sayılması tek bir yardımcıyla (`hasEnglish`) belirlenir. | §2.3 |

### 14.2 Review notes (how each review finding was handled)

All critical and major findings were adopted. Duplicate findings from the two reviews (bulk-notification conflict,
admin-plugin endpoints, page "used" definition, reactivation notification) were merged. Points adopted in a
different form than suggested:

- **`FOR SHARE` on page rows in `addTemplateStep` / `addPlanStep` / snapshot — not adopted.** Plan transactions lock
  the user row first; adding a page lock afterwards would invert the lock order of `changePageStatus` (page → users)
  and risk deadlocks. Instead: global lock order page → users, plan services read page status unlocked (a concurrent
  status change recomputes under the user lock afterwards), and a page deleted mid-flight surfaces as FK `23503` ⇒
  `CONFLICT` (§4.2, §1 "DB errors").
- **`deletePage` with `SELECT … FOR UPDATE` — adopted as `FOR NO KEY UPDATE`.** `FOR UPDATE` conflicts with the FK
  key-share locks that plan/template inserts take on the page while they already hold a user lock, which can deadlock
  with the archive path's user locks. A reference inserted between the check and the DELETE makes the DELETE fail with
  `23503`, mapped to `CONFLICT` (`library.errors.pageBecameUsed`); the retry archives.
- **Two blank lines between `app.ts` unit blocks — replaced by one blank line plus `>>>`/`<<<` markers.** Prettier
  collapses multiple blank lines; the markers alone guarantee at least three unchanged lines between any two units'
  edits, which is enough for git to merge cleanly.
- **Password reset vs. invitation — the "skip" option was chosen** (no reset mail without a credential password)
  rather than `onPasswordReset` auto-accepting, because K§3.2 already says an expired invite is resent by the admin.
- **Department deletion — the "empty teams go with it" option was chosen**, because K§8 lists only people and
  templates as blockers.
- **Search scope — events were added to search** instead of recording a narrowing, because K§5 explicitly names
  events.
- **Rate-limit tuning** stays in F1's `auth.ts`, driven by `APP_CONFIG.auth.rateLimit`, so F2a never edits `auth.ts`.

No finding was rejected.
