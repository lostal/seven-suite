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
    include: ["src/__tests__/integration/**/*.test.ts"],
    // Integration tests share the same DB — must run sequentially
    pool: "forks",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
