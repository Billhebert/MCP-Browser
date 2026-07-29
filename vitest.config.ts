import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { testTimeout: 30000, hookTimeout: 45000, include: ["tests/**/*.test.ts"], exclude: ["tests/e2e-web.test.ts"] },
});
