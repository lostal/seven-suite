/**
 * E2E: Smoke & Public Pages
 *
 * Tests que no requieren autenticación — siempre se ejecutan.
 */

import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("login page loads and shows Microsoft SSO button", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("button", { name: /microsoft/i })
    ).toBeVisible();
    await expect(page.getByText(/Bienvenido a Seven Suite/i)).toBeVisible();
  });

  test("root redirects away (to login when unauthenticated)", async ({
    page,
  }) => {
    await page.goto("/");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("page has correct title", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/Seven Suite/i);
  });
});
