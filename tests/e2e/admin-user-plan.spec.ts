import { expect, test, type Page } from "@playwright/test";
import { login } from "./support/auth";
import { ADMIN } from "./support/constants";

async function choose(page: Page, label: RegExp, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

test("an admin creates an employee and assigns a template to the plan", async ({ page }) => {
  const lastName = `Testmann${Date.now()}`;
  await login(page, ADMIN);
  await page.goto("/admin/users/new");

  await page.getByLabel("Vorname").fill("Erika");
  await page.getByLabel("Nachname").fill(lastName);
  await page.getByLabel("E-Mail-Adresse").fill(`erika.${lastName.toLowerCase()}@demo.test`);
  await choose(page, /^Rolle \*/, "Mitarbeitende");
  await choose(page, /^Team \*/, "Backend");
  await choose(page, /^Rolle im Unternehmen \*/, "Backend-Entwickler/in");
  await choose(page, /^Teamleitung \*/, "Jonas Keller");
  await page.getByLabel(/^Startdatum/).fill("2030-01-07");
  await page.getByRole("button", { name: "Anlegen und Einladung senden" }).click();

  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/);
  const userId = page.url().split("/").pop();

  await page.goto(`/team/${userId}`);
  await expect(page.getByText("Der Plan ist noch leer")).toBeVisible();

  await page.getByRole("button", { name: "Vorlagen zuweisen" }).click();
  const dialog = page.getByRole("dialog", { name: "Vorlagen zuweisen" });
  await expect(dialog.getByRole("checkbox", { name: "Allgemeines Onboarding" })).toBeChecked();
  await dialog.getByRole("button", { name: "Zuweisen" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Der Plan ist noch leer")).toBeHidden();
  await expect(page.getByText(/0 von [1-9]\d* Schritten erledigt/)).toBeVisible();
});
