import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/__test-helpers__/**"],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 85,
        statements: 80,
      },
    },
  },
});
