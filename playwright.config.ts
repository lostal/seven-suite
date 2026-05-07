import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for E2E Tests
 *
 * Proyectos:
 * - public: tests que no requieren auth (smoke, login page)
 * - setup: autenticación Microsoft SSO (se salta si no hay credenciales)
 * - chromium / mobile-chrome: tests autenticados (dependen de setup)
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Public pages — always run, no auth needed
    {
      name: "public",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Auth setup — runs once, can be skipped if no MS credentials
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Desktop Chrome — authenticated flows
    {
      name: "chromium",
      testMatch: /flows\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    // Mobile Chrome (Pixel 5) — authenticated flows
    {
      name: "mobile-chrome",
      testMatch: /flows\/.*\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
