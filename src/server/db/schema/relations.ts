import { relations } from "drizzle-orm";
import { accounts, sessions, users } from "./auth";
import { modules, pageEditLocks, pages, uploads } from "./content";
import { events } from "./events";
import { invitations } from "./invitations";
import { notifications } from "./notifications";
import { departments, jobRoles, teams } from "./org";
import { pageCompletions, userPlanSteps, userTemplateAssignments } from "./plans";
import { templateSteps, templates } from "./templates";

export const departmentsRelations = relations(departments, ({ many }) => ({
  teams: many(teams),
  templates: many(templates),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  department: one(departments, { fields: [teams.departmentId], references: [departments.id] }),
  users: many(users),
  templates: many(templates),
}));

export const jobRolesRelations = relations(jobRoles, ({ many }) => ({
  users: many(users),
  templates: many(templates),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  jobRole: one(jobRoles, { fields: [users.jobRoleId], references: [jobRoles.id] }),
  lead: one(users, { fields: [users.leadId], references: [users.id], relationName: "lead" }),
  ledUsers: many(users, { relationName: "lead" }),
  sessions: many(sessions),
  accounts: many(accounts),
  invitations: many(invitations, { relationName: "invitee" }),
  planSteps: many(userPlanSteps),
  completions: many(pageCompletions),
  templateAssignments: many(userTemplateAssignments),
  notifications: many(notifications, { relationName: "recipient" }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  user: one(users, {
    fields: [invitations.userId],
    references: [users.id],
    relationName: "invitee",
  }),
  creator: one(users, { fields: [invitations.createdBy], references: [users.id] }),
}));

export const modulesRelations = relations(modules, ({ many }) => ({
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  module: one(modules, { fields: [pages.moduleId], references: [modules.id] }),
  editor: one(users, { fields: [pages.updatedBy], references: [users.id] }),
  uploads: many(uploads),
  lock: one(pageEditLocks, { fields: [pages.id], references: [pageEditLocks.pageId] }),
  templateSteps: many(templateSteps),
  planSteps: many(userPlanSteps),
  completions: many(pageCompletions),
}));

export const uploadsRelations = relations(uploads, ({ one }) => ({
  page: one(pages, { fields: [uploads.pageId], references: [pages.id] }),
  uploader: one(users, { fields: [uploads.uploadedBy], references: [users.id] }),
}));

export const pageEditLocksRelations = relations(pageEditLocks, ({ one }) => ({
  page: one(pages, { fields: [pageEditLocks.pageId], references: [pages.id] }),
  user: one(users, { fields: [pageEditLocks.userId], references: [users.id] }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  department: one(departments, { fields: [templates.departmentId], references: [departments.id] }),
  team: one(teams, { fields: [templates.teamId], references: [teams.id] }),
  jobRole: one(jobRoles, { fields: [templates.jobRoleId], references: [jobRoles.id] }),
  steps: many(templateSteps),
  assignments: many(userTemplateAssignments),
}));

export const templateStepsRelations = relations(templateSteps, ({ one }) => ({
  template: one(templates, { fields: [templateSteps.templateId], references: [templates.id] }),
  page: one(pages, { fields: [templateSteps.pageId], references: [pages.id] }),
}));

export const userTemplateAssignmentsRelations = relations(userTemplateAssignments, ({ one }) => ({
  user: one(users, { fields: [userTemplateAssignments.userId], references: [users.id] }),
  template: one(templates, {
    fields: [userTemplateAssignments.templateId],
    references: [templates.id],
  }),
}));

export const userPlanStepsRelations = relations(userPlanSteps, ({ one }) => ({
  user: one(users, { fields: [userPlanSteps.userId], references: [users.id] }),
  page: one(pages, { fields: [userPlanSteps.pageId], references: [pages.id] }),
  sourceTemplate: one(templates, {
    fields: [userPlanSteps.sourceTemplateId],
    references: [templates.id],
  }),
}));

export const pageCompletionsRelations = relations(pageCompletions, ({ one }) => ({
  user: one(users, { fields: [pageCompletions.userId], references: [users.id] }),
  page: one(pages, { fields: [pageCompletions.pageId], references: [pages.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: "recipient",
  }),
  page: one(pages, { fields: [notifications.pageId], references: [pages.id] }),
  event: one(events, { fields: [notifications.eventId], references: [events.id] }),
  subjectUser: one(users, { fields: [notifications.subjectUserId], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  notifications: many(notifications),
}));
