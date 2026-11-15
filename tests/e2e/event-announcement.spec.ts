import { expect, test } from "@playwright/test";
import { login } from "./support/auth";
import { ADMIN, EMPLOYEE } from "./support/constants";

test("an announced event shows up in the employee's notification bell", async ({ browser }) => {
  const title = `E2E Sommerfest ${Date.now()}`;

  const adminContext = await browser.newContext({ locale: "de-DE" });
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN);
  await adminPage.goto("/admin/events/new");
  await adminPage.getByLabel("Titel (Deutsch)").fill(title);
  await adminPage.getByLabel("Beschreibung (Deutsch)").fill("Gemeinsames Fest im Garten.");
  await adminPage.getByLabel("Beginn").fill("2030-06-14T15:00");
  await adminPage.getByLabel("Ende").fill("2030-06-14T18:00");
  await adminPage.getByRole("button", { name: "Speichern" }).click();

  await expect(adminPage).toHaveURL(/\/admin\/events$/);
  const row = adminPage.getByRole("row", { name: new RegExp(title) });
  await row.getByRole("button", { name: "Ankündigen" }).click();
  const confirm = adminPage.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "Ankündigen" }).click();
  await expect(adminPage.getByText(/Angekündigt an \d+ Benutzer/)).toBeVisible();
  await adminContext.close();

  const employeeContext = await browser.newContext({ locale: "de-DE" });
  const employeePage = await employeeContext.newPage();
  await login(employeePage, EMPLOYEE);
  await employeePage.getByRole("button", { name: /^Benachrichtigungen/ }).click();
  await expect(
    employeePage
      .getByRole("list", { name: "Benachrichtigungen" })
      .getByText(`Neue Veranstaltung: ${title}`),
  ).toBeVisible();
  await employeeContext.close();
});
