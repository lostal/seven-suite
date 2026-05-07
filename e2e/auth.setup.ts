/**
 * E2E Auth Setup
 *
 * Seven Suite usa Microsoft Entra ID SSO (sin credentials provider).
 * Para ejecutar E2E con autenticación real, se requiere un tenant de Microsoft
 * con las credenciales configuradas en .env.local.
 *
 * Sin credenciales Microsoft, los tests autenticados se saltan.
 * Los tests de páginas públicas (login, redirects) siempre se ejecutan.
 *
 * Requisitos para tests autenticados:
 *   1. MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID en .env.local
 *   2. Un usuario de prueba con cuenta en ese tenant
 *   3. TEST_USER_EMAIL y TEST_USER_PASSWORD en variables de entorno
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;

  // Skip auth setup if no test credentials are configured
  if (!testEmail || !testPassword) {
    setup.skip(
      true,
      "TEST_USER_EMAIL and TEST_USER_PASSWORD not set — skipping auth"
    );
    return;
  }

  await page.goto("/login");

  // Click "Iniciar sesión con Microsoft"
  const msButton = page.getByRole("button", { name: /microsoft/i });
  if (!(await msButton.isVisible({ timeout: 5000 }))) {
    setup.skip(true, "Microsoft SSO button not found — skipping auth");
    return;
  }

  await msButton.click();

  // Microsoft login page — fill credentials
  // NOTE: Microsoft login page is on login.microsoftonline.com
  // The exact selectors depend on Microsoft's current UI
  await page.waitForURL(/login\.microsoftonline\.com|login\.live\.com/, {
    timeout: 15000,
  });

  // Microsoft login form
  const emailInput = page
    .getByPlaceholder(/email|correo|someone@example\.com/i)
    .or(page.getByLabel(/email|correo/i))
    .or(page.locator('input[type="email"]'))
    .first();

  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(testEmail);
    await page.getByRole("button", { name: /siguiente|next/i }).click();

    // Password step (may be on same or different page)
    await page.waitForTimeout(2000);
    const passwordInput = page
      .getByPlaceholder(/contraseña|password/i)
      .or(page.locator('input[type="password"]'))
      .first();
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      await passwordInput.fill(testPassword);
      await page.getByRole("button", { name: /iniciar|sign in/i }).click();
    }

    // "Stay signed in" prompt
    await page.waitForTimeout(2000);
    const staySignedIn = page.getByRole("button", { name: /sí|yes|aceptar/i });
    if (await staySignedIn.isVisible({ timeout: 3000 })) {
      await staySignedIn.click();
    }
  }

  // Should redirect back to the app after successful auth
  await expect(page).not.toHaveURL("/login", { timeout: 30000 });

  await page.context().storageState({ path: authFile });
});
