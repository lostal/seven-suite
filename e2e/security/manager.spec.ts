import { expect, test } from "@playwright/test";

test.describe("Manager entity boundaries", () => {
  test("cannot open global administration", async ({ page }) => {
    await page.goto("/administracion");
    await expect(page).not.toHaveURL(/\/administracion/);
  });

  test("can use the parking area", async ({ page }) => {
    await page.goto("/parking");
    await expect(page).toHaveURL(/\/parking/);
  });
});
