import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Node by default — admin's tests cover pure helpers (trace-format);
    // a DOM-dependent suite would opt in per file with a
    // `@vitest-environment jsdom` pragma, as webapp's stage.test.ts does.
    environment: "node",
  },
});
