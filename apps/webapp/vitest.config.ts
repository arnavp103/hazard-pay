import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Node by default; DOM-dependent suites opt in per file with a
    // `@vitest-environment jsdom` pragma (see src/match-proto/stage.test.ts).
    environment: "node",
  },
});
