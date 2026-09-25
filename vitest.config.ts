import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only the committed test tree is collected; stray copies of the
    // specs elsewhere must not run by accident.
    include: ["tests/**/*.spec.ts"],
  },
});
