import { LANDING_CONFIG } from "@/config/app";

const { planSteps } = LANDING_CONFIG.demo;

export type DemoStep = (typeof planSteps)[number];
export type DemoPersonKey = (typeof LANDING_CONFIG.demo.team)[number]["key"];

/** Progress of the sample plan before and after the animated step checks itself off. */
export const DEMO_PROGRESS = (() => {
  const total = planSteps.length;
  const before = planSteps.filter((step) => step.state === "done").length;
  const after = before + planSteps.filter((step) => step.state === "animated").length;
  return { total, before, after, fractionBefore: before / total, fractionAfter: after / total };
})();

/** Phases that occur in the sample plan, in plan order. */
export const DEMO_PLAN_PHASES = [...new Set(planSteps.map((step) => step.phase))];

/** Date-only config values ("2026-11-02") as instants; the formatter shows them in app time. */
export function demoDate(value: string): Date {
  return new Date(value);
}
