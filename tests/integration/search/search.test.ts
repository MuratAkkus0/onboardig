import { describe, expect, it } from "vitest";
import { search } from "@/server/services/search";
import {
  assignPlanSteps,
  createAdmin,
  createEmployee,
  createEvent,
  createLead,
  createModule,
  createPage,
} from "../../factories";
import { actorOf } from "../../helpers";

async function pageIds(actor: Parameters<typeof search>[0], q: string) {
  return (await search(actor, { q })).pages.map((hit) => hit.pageId).sort();
}

async function eventIds(actor: Parameters<typeof search>[0], q: string) {
  return (await search(actor, { q })).events.map((hit) => hit.eventId).sort();
}

describe("search pages", () => {
  it("employee finds only published pages of the own plan", async () => {
    const employee = await createEmployee();
    const inPlan = await createPage({ titleDe: "Laptop Einrichtung", status: "published" });
    const notInPlan = await createPage({ titleDe: "Laptop Rückgabe", status: "published" });
    const draftInPlan = await createPage({ titleDe: "Laptop Entwurf", status: "draft" });
    await createPage({ titleDe: "Laptop Archiv", status: "archived" });
    await assignPlanSteps(employee.id, [
      { pageId: inPlan.id, phase: "first_day" },
      { pageId: draftInPlan.id, phase: "first_day" },
    ]);
    expect(await pageIds(actorOf(employee), "Laptop")).toEqual([inPlan.id]);
    expect(await pageIds(actorOf(employee), "Laptop")).not.toContain(notInPlan.id);
  });

  it("lead finds published pages and never drafts; admin also sees drafts", async () => {
    const published = await createPage({ titleDe: "Spesen Regeln", status: "published" });
    const draft = await createPage({ titleDe: "Spesen Entwurf", status: "draft" });
    const archived = await createPage({ titleDe: "Spesen Alt", status: "archived" });
    const lead = await createLead();
    const admin = await createAdmin();
    expect(await pageIds(actorOf(lead), "Spesen")).toEqual([published.id]);
    expect(await pageIds(actorOf(admin), "Spesen")).toEqual([published.id, draft.id].sort());
    expect(await pageIds(actorOf(admin), "Spesen")).not.toContain(archived.id);
  });

  it("applies German stemming: Urlaubs finds Urlaub", async () => {
    const page = await createPage({
      titleDe: "Abwesenheit",
      textDe: "So beantragst du deinen Urlaub im Portal.",
      status: "published",
    });
    const lead = await createLead();
    expect(await pageIds(actorOf(lead), "Urlaubs")).toEqual([page.id]);
  });

  it("EN users search English text where available, German otherwise", async () => {
    const both = await createPage({
      titleDe: "Willkommen",
      textDe: "Hallo Kollegen",
      titleEn: "Welcome",
      textEn: "Greetings colleagues",
      contentEn: { type: "doc", content: [] },
      status: "published",
    });
    const onlyDe = await createPage({
      titleDe: "Brandschutz",
      textDe: "Feuerlöscher stehen im Flur",
      status: "published",
    });
    const enLead = await createLead({ locale: "en" });
    const deLead = await createLead({ locale: "de" });
    const en = actorOf(enLead);
    expect(await pageIds(en, "colleagues")).toEqual([both.id]);
    expect(await pageIds(en, "Kollegen")).toEqual([]);
    expect(await pageIds(en, "Feuerlöscher")).toEqual([onlyDe.id]);
    const hit = (await search(en, { q: "colleagues" })).pages[0];
    expect(hit?.title).toBe("Welcome");
    expect(await pageIds(actorOf(deLead), "Kollegen")).toEqual([both.id]);
    expect(await pageIds(actorOf(deLead), "colleagues")).toEqual([]);
  });

  it("ranks title matches above text matches and returns module title", async () => {
    const mod = await createModule({ titleDe: "Start" });
    const inText = await createPage({
      moduleId: mod.id,
      titleDe: "Allgemeines",
      textDe: "Hier geht es um Zugangskarten.",
      status: "published",
    });
    const inTitle = await createPage({
      moduleId: mod.id,
      titleDe: "Zugangskarten",
      textDe: "Wichtig.",
      status: "published",
    });
    const result = await search(actorOf(await createLead()), { q: "Zugangskarten" });
    expect(result.pages.map((hit) => hit.pageId)).toEqual([inTitle.id, inText.id]);
    expect(result.pages[0]?.moduleTitle).toBe("Start");
  });

  it("returns highlight ranges as plain text without markers or injected delimiters", async () => {
    await createPage({
      titleDe: "Sicherheit",
      textDe: "Passwort <b>x</b> ändern \u0002 \u0003",
      status: "published",
    });
    const [hit] = (await search(actorOf(await createLead()), { q: "Passwort" })).pages;
    const fragment = hit?.snippet[0];
    expect(fragment?.text).toContain("Passwort");
    expect(fragment?.text).not.toMatch(/[\u0001-\u0003]/);
    const [start, end] = fragment?.highlights[0] ?? [0, 0];
    expect(fragment?.text.slice(start, end)).toBe("Passwort");
  });

  it("returns nothing for too-short queries and rejects over-long ones", async () => {
    const lead = actorOf(await createLead());
    expect(await search(lead, { q: "a" })).toEqual({ pages: [], events: [] });
    await expect(search(lead, { q: "x".repeat(101) })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("search events", () => {
  it("finds events by title and description for every role", async () => {
    const byTitle = await createEvent({ titleDe: "Sommerfest", descriptionDe: "Grillen" });
    const byDescription = await createEvent({
      titleDe: "Treffen",
      descriptionDe: "Sommerfest-Planung",
    });
    await createEvent({ titleDe: "Anderes", descriptionDe: "Nichts" });
    const expected = [byTitle.id, byDescription.id].sort();
    for (const user of [await createEmployee(), await createLead(), await createAdmin()]) {
      expect(await eventIds(actorOf(user), "sommerfest")).toEqual(expected);
    }
  });

  it("treats % and _ in the query literally", async () => {
    const literal = await createEvent({ titleDe: "Bonus 100% sicher", descriptionDe: "x" });
    const under = await createEvent({ titleDe: "a_b Treffen", descriptionDe: "x" });
    await createEvent({ titleDe: "Bonus 100 Prozent", descriptionDe: "x" });
    await createEvent({ titleDe: "axb Treffen", descriptionDe: "x" });
    const actor = actorOf(await createEmployee());
    expect(await eventIds(actor, "100%")).toEqual([literal.id]);
    expect(await eventIds(actor, "a_b")).toEqual([under.id]);
    expect(await eventIds(actor, "%%")).toEqual([]);
  });

  it("searches the English variant for EN users when it exists", async () => {
    const event = await createEvent({
      titleDe: "Sommerfest",
      descriptionDe: "Grillen",
      titleEn: "Summer party",
      descriptionEn: "Barbecue",
    });
    const en = actorOf(await createEmployee({ locale: "en" }));
    expect(await eventIds(en, "barbecue")).toEqual([event.id]);
    expect(await eventIds(en, "Grillen")).toEqual([]);
    const hit = (await search(en, { q: "summer" })).events[0];
    expect(hit?.title).toBe("Summer party");
  });
});
