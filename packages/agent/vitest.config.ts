import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Reuses the db package's template-database setup: migrate
    // hazard_pay_template once per schema state, then each test clones it.
    globalSetup: ["./src/testing/global-setup.ts"],
    // Integration tests drive real Postgres transactions; keep the default
    // timeout generous enough for template cloning on a cold cache.
    testTimeout: 30_000,
  },
});
