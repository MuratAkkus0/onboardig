import { expect, test } from "@playwright/test";

test("the login route renders", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});
