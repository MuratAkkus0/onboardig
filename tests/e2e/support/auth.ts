import { expect, type Page } from "@playwright/test";

/** Signs in through the login form and waits until the app shell is shown. */
export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(account.email);
  await page.getByLabel("Passwort").fill(account.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /^Benachrichtigungen/ })).toBeVisible();
}
