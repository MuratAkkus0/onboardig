import {
  createAdmin,
  createDepartment,
  createEmployee,
  createLead,
  createModule,
  createPage,
  createTeam,
  createUser,
} from "../../factories";
import { actorOf } from "../../helpers";

/**
 * Two departments with one lead each, an admin, an employee, a lead without a team and modules:
 * one per department plus a company-wide one. Every module holds one page per status.
 */
export async function leadFixture() {
  const departmentA = await createDepartment({ name: "Dept A" });
  const departmentB = await createDepartment({ name: "Dept B" });
  const teamA = await createTeam({ departmentId: departmentA.id });
  const teamB = await createTeam({ departmentId: departmentB.id });
  const adminUser = await createAdmin();
  const leadAUser = await createLead({ teamId: teamA.id });
  const leadA2User = await createLead({ teamId: teamA.id });
  const leadBUser = await createLead({ teamId: teamB.id });
  const teamlessUser = await createUser({ role: "team_lead" });
  const employeeUser = await createEmployee({ teamId: teamA.id, leadId: leadAUser.id });

  async function moduleWithPages(departmentId: string | null, titleDe: string) {
    const mod = await createModule({ titleDe, departmentId });
    const draft = await createPage({
      moduleId: mod.id,
      status: "draft",
      titleDe: `${titleDe} draft`,
    });
    const published = await createPage({
      moduleId: mod.id,
      status: "published",
      titleDe: `${titleDe} published`,
    });
    const archived = await createPage({
      moduleId: mod.id,
      status: "archived",
      titleDe: `${titleDe} archived`,
    });
    return { module: mod, draft, published, archived };
  }

  return {
    departmentA,
    departmentB,
    teamA,
    teamB,
    admin: actorOf(adminUser),
    adminUser,
    leadA: actorOf(leadAUser),
    leadAUser,
    leadA2: actorOf(leadA2User),
    leadB: actorOf(leadBUser),
    leadBUser,
    teamless: actorOf(teamlessUser),
    employee: actorOf(employeeUser),
    a: await moduleWithPages(departmentA.id, "Mod A"),
    b: await moduleWithPages(departmentB.id, "Mod B"),
    all: await moduleWithPages(null, "Mod All"),
  };
}
