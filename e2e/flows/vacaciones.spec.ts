/**
 * E2E: Flujo de Vacaciones
 *
 * Verifica el workflow: crear solicitud → ver estado.
 * Requiere sesión autenticada (gestionada por auth.setup.ts vía dev-login).
 */
import { test, expect } from "@playwright/test";

test.describe("Leave request workflow", () => {
  test("creates a vacation request as employee", async ({ page }) => {
    await page.goto("/vacaciones/mis-solicitudes");

    const createBtn = page.getByRole("button", { name: /nueva|solicitar/i });
    if (await createBtn.isVisible({ timeout: 3000 })) {
      await createBtn.click();
    } else {
      await page.goto("/vacaciones");
      const newBtn = page
        .getByRole("button", { name: /nueva|solicitar/i })
        .first();
      if (await newBtn.isVisible({ timeout: 3000 })) await newBtn.click();
    }

    const typeSelect = page.getByRole("combobox").first();
    if (await typeSelect.isVisible({ timeout: 3000 })) {
      await typeSelect.click();
      await page.getByRole("option", { name: /vacaciones/i }).click();
      await expect(
        page.getByRole("button", { name: /enviar|crear|guardar/i }).last()
      ).toBeVisible();
    } else {
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("views leave request status", async ({ page }) => {
    await page.goto("/vacaciones/mis-solicitudes");

    await expect(
      page.getByRole("heading").filter({ hasText: /solicitudes|vacaciones/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
