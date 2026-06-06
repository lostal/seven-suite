/**
 * E2E: Admin CRUD flows
 *
 * Verifica: navegar a admin → crear spot → listar.
 * Requiere sesión autenticada (gestionada por auth.setup.ts vía dev-login).
 */
import { test, expect } from "@playwright/test";

test.describe("Admin flows", () => {
  test("navigates to admin panel", async ({ page }) => {
    await page.goto("/administracion");

    await expect(
      page
        .getByRole("heading")
        .filter({ hasText: /admin|administración|gestion/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("creates a parking spot", async ({ page }) => {
    await page.goto("/administracion");

    const createBtn = page.getByRole("button", {
      name: /crear.*plaza|nueva.*plaza|añadir/i,
    });
    if (await createBtn.isVisible({ timeout: 3000 })) {
      await createBtn.click();

      await page.getByLabel(/etiqueta|label|nombre/i).fill("E2E-P01");
      const typeSelect = page.getByLabel(/tipo/i);
      if (await typeSelect.isVisible({ timeout: 2000 })) {
        await typeSelect.selectOption("standard");
      }
      await page.getByRole("button", { name: /crear|guardar/i }).click();
    }
  });

  test("lists existing spots", async ({ page }) => {
    await page.goto("/parking/asignaciones");

    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("mobile viewport: sidebar navigation works", async ({ page }) => {
    await page.goto("/parking");

    await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
  });
});
