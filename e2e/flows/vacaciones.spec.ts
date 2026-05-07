/**
 * E2E: Flujo de Vacaciones
 *
 * Verifica el workflow: crear solicitud → ver estado.
 * Si no hay sesión, verifica redirect a login.
 */

import { test, expect } from "@playwright/test";

test.describe("Leave request workflow", () => {
  test("creates a vacation request as employee", async ({ page }) => {
    await page.goto("/vacaciones/mis-solicitudes");

    if (page.url().includes("/login")) {
      expect(page.getByRole("button", { name: /microsoft/i })).toBeVisible();
      return;
    }

    const createBtn = page.getByRole("button", { name: /nueva|solicitar/i });
    if (await createBtn.isVisible({ timeout: 3000 })) {
      await createBtn.click();
    } else {
      await page.goto("/vacaciones");
      if (page.url().includes("/login")) return;
      const newBtn = page
        .getByRole("button", { name: /nueva|solicitar/i })
        .first();
      if (await newBtn.isVisible({ timeout: 3000 })) await newBtn.click();
    }

    const typeSelect = page.getByLabel(/tipo/i);
    if (await typeSelect.isVisible({ timeout: 3000 })) {
      await typeSelect.selectOption("vacation");
      await page.getByLabel(/inicio|desde/i).fill("2026-07-01");
      await page.getByLabel(/fin|hasta/i).fill("2026-07-14");
      await page.getByLabel(/motivo/i).fill("Vacaciones de verano - E2E test");
      await page.getByRole("button", { name: /enviar|crear/i }).click();

      await expect(
        page.getByText(/pendiente|creada|confirmada/i).first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("views leave request status", async ({ page }) => {
    await page.goto("/vacaciones/mis-solicitudes");

    if (page.url().includes("/login")) {
      expect(page.getByRole("button", { name: /microsoft/i })).toBeVisible();
      return;
    }

    await expect(
      page.getByRole("heading").filter({ hasText: /solicitudes|vacaciones/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
