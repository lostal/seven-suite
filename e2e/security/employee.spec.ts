import { expect, test } from "@playwright/test";

test.describe("Employee boundaries", () => {
  test("cannot open administration", async ({ page }) => {
    await page.goto("/administracion");
    await expect(page).not.toHaveURL(/\/administracion/);
  });

  test("can read the directory without administration access", async ({
    page,
  }) => {
    await page.goto("/directorio");
    await expect(page).toHaveURL(/\/directorio/);
  });
});
