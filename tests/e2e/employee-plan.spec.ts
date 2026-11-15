import { expect, test } from "@playwright/test";
import { login } from "./support/auth";
import { EMPLOYEE } from "./support/constants";

test("an employee opens the plan and completes a step", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Mein Onboarding-Plan", level: 1 })).toBeVisible();

  const summary = page.getByText(/\d+ von \d+ Schritten erledigt/);
  await expect(summary).toBeVisible();
  const before = Number((await summary.innerText()).match(/^(\d+) von/)?.[1]);

  await page.getByRole("button", { name: "Erledigt", exact: true }).first().click();

  await expect(summary).toHaveText(new RegExp(`^${before + 1} von \\d+ Schritten erledigt`));
});
