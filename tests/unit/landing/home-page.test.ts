import { beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING_CONFIG, ROUTES } from "@/config/app";
import type { Actor } from "@/server/auth/types";

const state = vi.hoisted(() => ({ actor: null as Actor | null }));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);

vi.mock("@/server/auth/actor", () => ({ getActor: async () => state.actor }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/components/landing/landing-page", () => ({ LandingPage: () => null }));

const { default: HomePage, generateMetadata } = await import("@/app/(public)/page");
const { LandingPage } = await import("@/components/landing/landing-page");

describe("home page (/)", () => {
  beforeEach(() => {
    state.actor = null;
    redirect.mockClear();
  });

  it.each([
    ["employee", ROUTES.plan],
    ["team_lead", ROUTES.team],
    ["admin", ROUTES.admin],
  ] as const)("redirects a signed-in %s to %s", async (role, target) => {
    state.actor = { role } as Actor;
    await expect(HomePage()).rejects.toThrow(`NEXT_REDIRECT ${target}`);
    expect(redirect).toHaveBeenCalledWith(target);
  });

  it("renders the landing page without a session", async () => {
    const element = await HomePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(element.type).toBe(LandingPage);
  });

  it("uses the landing texts and the configured robots policy", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toEqual({ absolute: "meta.title" });
    expect(metadata.description).toBe("meta.description");
    expect(metadata.robots).toEqual({
      index: LANDING_CONFIG.robotsIndex,
      follow: LANDING_CONFIG.robotsIndex,
    });
  });
});

describe("landing demo content", () => {
  it("never claims a tracking service", () => {
    expect(LANDING_CONFIG.trackingServiceCount).toBe(0);
  });

  it("animates exactly one step from open to done", () => {
    const animated = LANDING_CONFIG.demo.planSteps.filter((step) => step.state === "animated");
    expect(animated).toHaveLength(1);
  });

  it("does not show a new hire holding the editor lock (employees cannot edit pages)", () => {
    const newHires: readonly string[] = LANDING_CONFIG.demo.team.map((person) => person.key);
    expect(newHires).not.toContain(LANDING_CONFIG.demo.lock.person);
  });

  it("shows every first-day step of the hero plan in the phases timeline", () => {
    const heroFirstDay = LANDING_CONFIG.demo.planSteps
      .filter((step) => step.phase === "first_day")
      .map((step) => step.key);
    const chips = LANDING_CONFIG.demo.phaseChips.first_day.map((chip) => chip.key);
    expect(chips).toEqual(expect.arrayContaining(heroFirstDay));
  });
});
