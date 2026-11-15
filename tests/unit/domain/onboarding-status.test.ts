import { describe, expect, it } from "vitest";
import { applyOnboardingEvent, canDeletePermanently } from "@/lib/domain/onboarding-status";

describe("onboarding status machine", () => {
  it("completes an active user when all steps are done", () => {
    expect(applyOnboardingEvent("active", { type: "progress", completed: 3, total: 3 })).toEqual({
      status: "completed",
      changed: true,
      becameCompleted: true,
    });
  });

  it("keeps a user active while progress is below 100 percent", () => {
    expect(applyOnboardingEvent("active", { type: "progress", completed: 2, total: 3 })).toEqual({
      status: "active",
      changed: false,
      becameCompleted: false,
    });
  });

  it("returns to active when progress drops below 100 percent", () => {
    expect(applyOnboardingEvent("completed", { type: "progress", completed: 2, total: 3 })).toEqual(
      {
        status: "active",
        changed: true,
        becameCompleted: false,
      },
    );
  });

  it("does not report a new completion for an already completed user", () => {
    expect(applyOnboardingEvent("completed", { type: "progress", completed: 3, total: 3 })).toEqual(
      {
        status: "completed",
        changed: false,
        becameCompleted: false,
      },
    );
  });

  it("keeps an empty plan active", () => {
    expect(
      applyOnboardingEvent("active", { type: "progress", completed: 0, total: 0 }).status,
    ).toBe("active");
    expect(
      applyOnboardingEvent("completed", { type: "progress", completed: 0, total: 0 }).status,
    ).toBe("active");
  });

  it("ignores progress on archived users", () => {
    expect(applyOnboardingEvent("archived", { type: "progress", completed: 3, total: 3 })).toEqual({
      status: "archived",
      changed: false,
      becameCompleted: false,
    });
  });

  it("deactivates active and completed users and reactivates archived ones", () => {
    expect(applyOnboardingEvent("active", { type: "deactivate" }).status).toBe("archived");
    expect(applyOnboardingEvent("completed", { type: "deactivate" }).status).toBe("archived");
    expect(applyOnboardingEvent("archived", { type: "reactivate" }).status).toBe("active");
  });

  it("rejects invalid deactivate / reactivate", () => {
    expect(() => applyOnboardingEvent("archived", { type: "deactivate" })).toThrow();
    expect(() => applyOnboardingEvent("active", { type: "reactivate" })).toThrow();
    expect(() => applyOnboardingEvent("completed", { type: "reactivate" })).toThrow();
  });

  it("allows permanent deletion only for archived users", () => {
    expect(canDeletePermanently("archived")).toBe(true);
    expect(canDeletePermanently("active")).toBe(false);
    expect(canDeletePermanently("completed")).toBe(false);
  });
});
