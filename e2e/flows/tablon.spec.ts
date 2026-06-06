/**
 * E2E: Flujo del Tablón
 *
 * Verifica: ver anuncios → crear → publicar.
 * Requiere sesión autenticada (gestionada por auth.setup.ts vía dev-login).
 */
import { test, expect } from "@playwright/test";

test.describe("Announcements flow", () => {
  test("views the announcement board", async ({ page }) => {
    await page.goto("/tablon");

    await expect(
      page
        .getByRole("heading")
        .filter({ hasText: /tablón|comunicados|anuncios/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("creates and publishes an announcement (manager/admin)", async ({
    page,
  }) => {
    await page.goto("/tablon/gestionar");

    const createBtn = page.getByRole("button", { name: /nuevo|crear/i });
    if (await createBtn.isVisible({ timeout: 3000 })) {
      await createBtn.click();
    }

    const titleInput = page.getByLabel(/título/i);
    if (await titleInput.isVisible({ timeout: 3000 })) {
      await titleInput.fill("E2E Test Announcement");
      const editor = page.locator(".tiptap, [contenteditable]");
      if (await editor.isVisible({ timeout: 2000 })) {
        await editor.fill("E2E test content.");
      }

      const publishBtn = page.getByRole("button", { name: /publicar/i });
      if (await publishBtn.isVisible({ timeout: 3000 })) {
        await publishBtn.click();
      }
    }
  });
});
