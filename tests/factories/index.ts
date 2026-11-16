import { hashPassword } from "better-auth/crypto";
import { db } from "@/server/db/client";
import {
  accounts,
  departments,
  events,
  feedbackReports,
  jobRoles,
  modules,
  notifications,
  pageCompletions,
  pageEditLocks,
  pages,
  teams,
  templateSteps,
  templates,
  userPlanSteps,
  users,
} from "@/server/db/schema";
import type {
  AppEvent,
  Department,
  FeedbackReport,
  JobRole,
  Module,
  NewAppEvent,
  NewDepartment,
  NewFeedbackReport,
  NewJobRole,
  NewModule,
  NewNotification,
  NewPage,
  NewTeam,
  NewTemplate,
  NewUser,
  Notification,
  Page,
  PageEditLock,
  Team,
  Template,
  User,
} from "@/server/db/types";
import type { PHASES } from "@/config/app";
import { doc } from "../helpers/tiptap";

type Phase = (typeof PHASES)[number];

let counter = 0;
const next = (): number => {
  counter += 1;
  return counter;
};

function one<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createDepartment(
  overrides: Partial<NewDepartment> = {},
): Promise<Department> {
  return one(
    await db
      .insert(departments)
      .values({ name: `Department ${next()}`, ...overrides })
      .returning(),
  );
}

export async function createTeam(
  overrides: Partial<NewTeam> & { departmentId?: string } = {},
): Promise<Team> {
  const departmentId = overrides.departmentId ?? (await createDepartment()).id;
  return one(
    await db
      .insert(teams)
      .values({ name: `Team ${next()}`, ...overrides, departmentId })
      .returning(),
  );
}

export async function createJobRole(overrides: Partial<NewJobRole> = {}): Promise<JobRole> {
  return one(
    await db
      .insert(jobRoles)
      .values({ name: `Job role ${next()}`, ...overrides })
      .returning(),
  );
}

export type CreateUserInput = Partial<NewUser> & {
  /** When set, a credential account with this password is created as well. */
  password?: string;
};

export async function createUser(input: CreateUserInput = {}): Promise<User> {
  const { password, ...overrides } = input;
  const n = next();
  const firstName = overrides.firstName ?? "Test";
  const lastName = overrides.lastName ?? `User${n}`;
  const user = one(
    await db
      .insert(users)
      .values({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        email: `user${n}@example.test`,
        emailVerified: true,
        ...overrides,
      })
      .returning(),
  );
  if (password) {
    await db.insert(accounts).values({
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await hashPassword(password),
    });
  }
  return user;
}

export function createAdmin(overrides: CreateUserInput = {}): Promise<User> {
  return createUser({ role: "admin", ...overrides });
}

export async function createLead(overrides: CreateUserInput = {}): Promise<User> {
  const teamId = overrides.teamId ?? (await createTeam()).id;
  const jobRoleId = overrides.jobRoleId ?? (await createJobRole()).id;
  return createUser({
    role: "team_lead",
    teamId,
    jobRoleId,
    startDate: "2026-01-01",
    ...overrides,
  });
}

/** Creates org rows and a lead when they are not passed in. */
export async function createEmployee(overrides: CreateUserInput = {}): Promise<User> {
  const teamId = overrides.teamId ?? (await createTeam()).id;
  const jobRoleId = overrides.jobRoleId ?? (await createJobRole()).id;
  const leadId = overrides.leadId ?? (await createLead({ teamId })).id;
  return createUser({
    role: "employee",
    teamId,
    jobRoleId,
    leadId,
    startDate: "2026-03-01",
    ...overrides,
  });
}

export async function createModule(overrides: Partial<NewModule> = {}): Promise<Module> {
  return one(
    await db
      .insert(modules)
      .values({ titleDe: `Module ${next()}`, ...overrides })
      .returning(),
  );
}

export async function createPage(overrides: Partial<NewPage> = {}): Promise<Page> {
  const moduleId = overrides.moduleId ?? (await createModule()).id;
  const n = next();
  return one(
    await db
      .insert(pages)
      .values({
        titleDe: `Seite ${n}`,
        contentDe: doc(`Inhalt ${n}`),
        textDe: `Inhalt ${n}`,
        ...overrides,
        moduleId,
      })
      .returning(),
  );
}

export interface StepInput {
  pageId: string;
  phase: Phase;
}

export async function createTemplate(
  overrides: Partial<NewTemplate> & { steps?: StepInput[] } = {},
): Promise<Template> {
  const { steps = [], ...values } = overrides;
  const template = one(
    await db
      .insert(templates)
      .values({ name: `Template ${next()}`, ...values })
      .returning(),
  );
  if (steps.length > 0) {
    await db.insert(templateSteps).values(
      steps.map((step, index) => ({
        templateId: template.id,
        pageId: step.pageId,
        phase: step.phase,
        sortOrder: index,
      })),
    );
  }
  return template;
}

export async function assignPlanSteps(userId: string, steps: StepInput[]): Promise<void> {
  if (steps.length === 0) return;
  await db.insert(userPlanSteps).values(
    steps.map((step, index) => ({
      userId,
      pageId: step.pageId,
      phase: step.phase,
      sortOrder: index,
    })),
  );
}

export async function completePage(userId: string, pageId: string, at?: Date): Promise<void> {
  await db.insert(pageCompletions).values({ userId, pageId, ...(at ? { completedAt: at } : {}) });
}

export async function createEvent(overrides: Partial<NewAppEvent> = {}): Promise<AppEvent> {
  const startsAt = overrides.startsAt ?? new Date(Date.now() + 24 * 60 * 60_000);
  return one(
    await db
      .insert(events)
      .values({
        titleDe: `Veranstaltung ${next()}`,
        descriptionDe: "Beschreibung",
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
        ...overrides,
        startsAt,
      })
      .returning(),
  );
}

export async function createNotification(
  overrides: Partial<NewNotification> & { userId: string },
): Promise<Notification> {
  return one(
    await db
      .insert(notifications)
      .values({
        type: "step_added",
        messageKey: "notificationItems.stepAdded",
        ...overrides,
      })
      .returning(),
  );
}

export async function createLock(input: {
  pageId: string;
  userId: string;
  expiresAt?: Date;
  acquiredAt?: Date;
}): Promise<PageEditLock> {
  const acquiredAt = input.acquiredAt ?? new Date();
  return one(
    await db
      .insert(pageEditLocks)
      .values({
        pageId: input.pageId,
        userId: input.userId,
        acquiredAt,
        expiresAt: input.expiresAt ?? new Date(acquiredAt.getTime() + 120_000),
      })
      .returning(),
  );
}

/** Direct insert (bypasses the service, so rate limit and path rules do not apply). */
export async function createFeedbackReport(
  overrides: Partial<NewFeedbackReport> = {},
): Promise<FeedbackReport> {
  const n = next();
  return one(
    await db
      .insert(feedbackReports)
      .values({ type: "other", subject: `Subject ${n}`, message: `Message ${n}`, ...overrides })
      .returning(),
  );
}
