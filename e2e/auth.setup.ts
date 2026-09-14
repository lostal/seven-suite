/**
 * E2E Auth Setup — Dev Login
 *
 * Autentica usando la página de /dev-login (solo disponible en desarrollo).
 * Selecciona el rol Administrador para tener acceso completo a todos los módulos.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate via dev-login", async ({ page }) => {
  await page.goto("/dev-login");

  // El botón de Administrador es el primero
  const adminButton = page.getByText("Administrador");
  await expect(adminButton).toBeVisible({ timeout: 5000 });
  await adminButton.click();

  // Debe redirigir al dashboard (no a /login)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/panel/, { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});

setup("authenticate restricted roles", async ({ browser }) => {
  for (const [role, fileName] of [
    ["Manager", "manager.json"],
    ["Empleado 1", "employee.json"],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/dev-login");
    await page.getByText(role, { exact: true }).click();
    await expect(page).toHaveURL(/\/parking/, { timeout: 15000 });
    await context.storageState({
      path: path.join(__dirname, `.auth/${fileName}`),
    });
    await context.close();
  }
});
