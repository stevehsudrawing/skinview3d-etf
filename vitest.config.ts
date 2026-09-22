import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The first real specs arrive with Phase B (decode core). Until
    // then, an empty suite must not fail the run.
    passWithNoTests: true,
  },
});
