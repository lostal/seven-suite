import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    env: {
      DATABASE_URL:
        "postgresql://seven_suite:seven_suite_dev@localhost:5432/seven_suite_test",
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e", "src/__tests__/integration/**"],
    // Limpiar mocks automáticamente antes de cada test (best practice)
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Solo medir cobertura en lógica de negocio — no en UI components ni páginas
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/app/**/actions.ts",
        "src/app/**/calendar-actions.ts",
        "src/app/**/cession-actions.ts",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/__tests__/**",
      ],
      // Umbrales de cobertura — elevados a nivel sobresaliente (mayo 2026).
      // Cobertura real: 81% stmts, 72% branches, 67% funcs, 82% lines.
      // Tests de integración: `pnpm test:integration` (requiere Docker PostgreSQL).
      // Tests E2E: `pnpm test:e2e` (requiere servidor Next.js corriendo).
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 65,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
