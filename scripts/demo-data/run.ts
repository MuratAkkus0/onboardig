import { randomBytes } from "node:crypto";
import { APP_CONFIG } from "@/config/app";
import type { Actor } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { createInitialAdmin } from "@/server/services/bootstrap";
import { createEvent, announceEvent } from "@/server/services/events";
import { acceptInvitation, issueInvitationInTx } from "@/server/services/invitations";
import { acquireLock, releaseLock } from "@/server/services/locks";
import { createModule } from "@/server/services/modules";
import { markAllRead } from "@/server/services/notifications";
import { createTeam, createDepartment, createJobRole } from "@/server/services/org";
import { changePageStatus, createPage, savePageContent } from "@/server/services/pages";
import { assignTemplates, getMyPlan, setStepCompletion } from "@/server/services/plans";
import { addTemplateStep, createTemplate } from "@/server/services/templates";
import { createUser, deactivateUser, type UserListItem } from "@/server/services/users";
import { DEMO_MODULES, DEMO_PAGE_UPDATE, DEMO_PAGES } from "./content";
import { countUsers, wipeAllTables } from "./database";
import { DEMO_EVENTS } from "./events";
import { assertSeedAllowed } from "./guard";
import { DEMO_DEPARTMENTS, DEMO_JOB_ROLES } from "./org";
import { DEMO_ADMIN, DEMO_PEOPLE } from "./people";
import { DEMO_TEMPLATES } from "./templates";
import { withParagraph } from "./doc";
import type { DemoPerson } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface SeedOptions {
  reset: boolean;
  /** Password for every demo account; generated when omitted. */
  password?: string;
  nodeEnv?: string | undefined;
  log?: (line: string) => void;
}

export interface DemoCredential {
  role: string;
  name: string;
  email: string;
  state: string;
}

export interface SeedResult {
  password: string;
  credentials: DemoCredential[];
}

function actorFrom(
  user: Pick<UserListItem, "id" | "role" | "email" | "firstName" | "lastName">,
  locale: Actor["locale"],
): Actor {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    locale,
    theme: APP_CONFIG.theme.default,
  };
}

function isoDate(base: Date, offsetDays: number): string {
  return new Date(base.getTime() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function lookup<T>(map: Map<string, T>, key: string): T {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Demo data references unknown key "${key}"`);
  return value;
}

async function setPassword(userId: string, adminId: string, password: string): Promise<void> {
  const { token } = await db.transaction((tx) =>
    issueInvitationInTx(tx, { userId, createdBy: adminId }),
  );
  await acceptInvitation({ token, password });
}

function describeState(person: DemoPerson): string {
  if (person.role !== "employee") return "-";
  if (person.archived) return "archiviert / archived";
  if (person.templateKeys.length === 0) return "kein Plan / no plan";
  return person.completes === "all" ? "abgeschlossen / completed" : "in Arbeit / in progress";
}

/**
 * Fills an empty database with fictional demo data, strictly through the service layer.
 * @throws SeedRefusedError when users exist (unless `reset` on a non-production database).
 */
export async function runDemoSeed(options: SeedOptions): Promise<SeedResult> {
  const log = options.log ?? (() => undefined);
  assertSeedAllowed({
    userCount: await countUsers(),
    reset: options.reset,
    nodeEnv: options.nodeEnv ?? process.env.NODE_ENV,
  });
  if (options.reset) {
    log("Wiping all application data (--reset)");
    await wipeAllTables();
  }

  const now = new Date();
  const password = options.password ?? randomBytes(12).toString("base64url");

  // Admin (bootstrap, no actor yet)
  const { userId: adminId } = await createInitialAdmin({
    ...DEMO_ADMIN,
    password,
    locale: "de",
  });
  const admin: Actor = actorFrom({ id: adminId, role: "admin", ...DEMO_ADMIN }, "de");

  // Organization
  log("Creating departments, teams and job roles");
  const departmentIds = new Map<string, string>();
  const teamIds = new Map<string, string>();
  for (const department of DEMO_DEPARTMENTS) {
    const created = await createDepartment(admin, { name: department.name });
    departmentIds.set(department.key, created.id);
    for (const team of department.teams) {
      const createdTeam = await createTeam(admin, { departmentId: created.id, name: team.name });
      teamIds.set(team.key, createdTeam.id);
    }
  }
  const jobRoleIds = new Map<string, string>();
  for (const role of DEMO_JOB_ROLES) {
    const created = await createJobRole(admin, {
      name: role.name,
      departmentId: role.departmentKey ? lookup(departmentIds, role.departmentKey) : null,
    });
    jobRoleIds.set(role.key, created.id);
  }

  // Library: modules and pages (edited under the edit lock, then published)
  log("Creating modules and pages");
  const moduleIds = new Map<string, string>();
  for (const entry of DEMO_MODULES) {
    moduleIds.set(
      entry.key,
      (
        await createModule(admin, {
          titleDe: entry.titleDe,
          titleEn: entry.titleEn,
          departmentId: entry.departmentKey ? lookup(departmentIds, entry.departmentKey) : null,
        })
      ).id,
    );
  }
  const pageIds = new Map<string, string>();
  for (const page of DEMO_PAGES) {
    const { id } = await createPage(admin, {
      moduleId: lookup(moduleIds, page.moduleKey),
      titleDe: page.titleDe,
    });
    pageIds.set(page.key, id);
    await acquireLock(admin, { pageId: id });
    await savePageContent(admin, {
      id,
      titleDe: page.titleDe,
      titleEn: page.titleEn,
      contentDe: page.contentDe,
      contentEn: page.contentEn,
    });
    await releaseLock(admin, { pageId: id });
    if (page.status !== "draft") await changePageStatus(admin, { id, action: "publish" });
    if (page.status === "archived") await changePageStatus(admin, { id, action: "archive" });
  }

  // Templates
  log("Creating templates");
  const templateIds = new Map<string, string>();
  for (const template of DEMO_TEMPLATES) {
    const { id } = await createTemplate(admin, {
      name: template.name,
      description: template.description,
      departmentId:
        template.departmentKey === "all" ? "all" : lookup(departmentIds, template.departmentKey),
      teamId: template.teamKey ? lookup(teamIds, template.teamKey) : null,
    });
    templateIds.set(template.key, id);
    for (const step of template.steps) {
      await addTemplateStep(admin, {
        templateId: id,
        pageId: lookup(pageIds, step.pageKey),
        phase: step.phase,
      });
    }
  }

  // People: created by the admin, password set through the invitation flow
  log("Creating users and assigning plans");
  const userIds = new Map<string, string>();
  const actors = new Map<string, Actor>();
  for (const person of DEMO_PEOPLE) {
    const { user } = await createUser(admin, {
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      role: person.role,
      teamId: person.teamKey ? lookup(teamIds, person.teamKey) : null,
      jobRoleId: person.jobRoleKey ? lookup(jobRoleIds, person.jobRoleKey) : null,
      leadId: person.leadKey ? lookup(userIds, person.leadKey) : null,
      startDate: person.startOffsetDays === null ? null : isoDate(now, person.startOffsetDays),
      locale: person.locale,
    });
    userIds.set(person.key, user.id);
    actors.set(person.key, actorFrom(user, person.locale));
    await setPassword(user.id, adminId, password);
    if (person.templateKeys.length > 0) {
      await assignTemplates(admin, {
        userId: user.id,
        templateIds: person.templateKeys.map((key) => lookup(templateIds, key)),
      });
    }
  }

  // Partial progress, completed onboarding
  log("Recording progress");
  for (const person of DEMO_PEOPLE) {
    if (person.templateKeys.length === 0) continue;
    const actor = lookup(actors, person.key);
    const plan = await getMyPlan(actor);
    const pageIdsInOrder = plan.phases.flatMap((phase) => phase.steps.map((step) => step.pageId));
    const toComplete =
      person.completes === "all" ? pageIdsInOrder : pageIdsInOrder.slice(0, person.completes);
    for (const pageId of toComplete) {
      await setStepCompletion(actor, { pageId, completed: true });
    }
  }

  const archivedPerson = DEMO_PEOPLE.find((person) => person.archived);
  if (archivedPerson) {
    await deactivateUser(admin, { id: lookup(userIds, archivedPerson.key) });
  }

  // A later content change: notifies assigned employees and flags completed steps as updated
  log("Updating a published page");
  const updatedPage = DEMO_PAGES.find((page) => page.key === DEMO_PAGE_UPDATE.pageKey);
  if (updatedPage?.titleEn && updatedPage.contentEn) {
    const pageId = lookup(pageIds, updatedPage.key);
    await acquireLock(admin, { pageId });
    await savePageContent(admin, {
      id: pageId,
      titleDe: updatedPage.titleDe,
      titleEn: updatedPage.titleEn,
      contentDe: withParagraph(updatedPage.contentDe, DEMO_PAGE_UPDATE.extraDe),
      contentEn: withParagraph(updatedPage.contentEn, DEMO_PAGE_UPDATE.extraEn),
    });
    await releaseLock(admin, { pageId });
  }

  // Events and announcements
  log("Creating events");
  for (const event of DEMO_EVENTS) {
    const day = new Date(now.getTime() + event.startOffsetDays * DAY_MS);
    day.setUTCHours(event.startHour, 0, 0, 0);
    const created = await createEvent(admin, {
      titleDe: event.titleDe,
      titleEn: event.titleEn,
      descriptionDe: event.descriptionDe,
      descriptionEn: event.descriptionEn,
      location: event.location,
      startsAt: day,
      endsAt: new Date(day.getTime() + event.durationHours * HOUR_MS),
    });
    if (event.announce) await announceEvent(admin, { id: created.id });
  }

  // One user with an empty inbox, everybody else keeps unread notifications
  await markAllRead(lookup(actors, "tim"));

  return {
    password,
    credentials: [
      {
        role: "admin",
        name: `${DEMO_ADMIN.firstName} ${DEMO_ADMIN.lastName}`,
        email: DEMO_ADMIN.email,
        state: "-",
      },
      ...DEMO_PEOPLE.map((person) => ({
        role: person.role,
        name: `${person.firstName} ${person.lastName}`,
        email: person.email,
        state: describeState(person),
      })),
    ],
  };
}
