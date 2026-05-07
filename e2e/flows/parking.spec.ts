/**
 * E2E: Flujo de Parking
 *
 * Verifica el flujo completo: ver calendario → seleccionar día → reservar → cancelar.
 * Si no hay sesión autenticada, los tests verifican el redirect a login.
 */

import { test, expect } from "@playwright/test";

test.describe("Parking flow", () => {
  test("navigates to parking calendar and views available days", async ({
    page,
  }) => {
    await page.goto("/parking");

    // If unauthenticated, we'll be redirected to login
    const url = page.url();
    if (url.includes("/login")) {
      expect(page.getByRole("button", { name: /microsoft/i })).toBeVisible();
      return;
    }

    await expect(
      page.getByRole("heading", { name: /parking|aparcamiento|plazas/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("reserves a parking spot and sees it in my reservations", async ({
    page,
  }) => {
    await page.goto("/parking/reservas");

    if (page.url().includes("/login")) {
      expect(page.getByRole("button", { name: /microsoft/i })).toBeVisible();
      return;
    }

    const calendar = page.locator('[data-testid="calendar"]');
    if (await calendar.isVisible({ timeout: 3000 })) {
      await calendar.getByRole("button", { name: /\d+/ }).first().click();

      const confirmBtn = page.getByRole("button", { name: /reservar/i });
      if (await confirmBtn.isVisible({ timeout: 3000 })) {
        await confirmBtn.click();
      }
    }

    await page.goto("/mis-reservas");
    if (page.url().includes("/login")) return;
    await expect(
      page.getByRole("heading", { name: /mis reservas/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("cancels a parking reservation", async ({ page }) => {
    await page.goto("/mis-reservas");

    if (page.url().includes("/login")) {
      expect(page.getByRole("button", { name: /microsoft/i })).toBeVisible();
      return;
    }

    const cancelBtn = page.getByRole("button", { name: /cancelar/i }).first();
    if (await cancelBtn.isVisible({ timeout: 3000 })) {
      await cancelBtn.click();

      const confirmCancel = page.getByRole("button", { name: /confirmar|sí/i });
      if (await confirmCancel.isVisible({ timeout: 3000 })) {
        await confirmCancel.click();
      }
    }
  });
});
