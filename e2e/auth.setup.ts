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
  await expect(page).toHaveURL(/\/parking/, { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
