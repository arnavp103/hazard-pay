import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { loadEnv } from "./load-env.ts";

// Pull the root `.env` from the main checkout (reachable from any agent
// worktree via the git common dir) into process.env before validation.
// Already-set variables win over file values.
loadEnv();

/**
 * Every variable carries a default, so importing this module never throws for a
 * missing variable — lint, test, and type-check stay runnable with no `.env`
 * present. A variable that genuinely cannot be defaulted goes in without one,
 * making it boot-required by design rather than by accident.
 *
 * `SKIP_ENV_VALIDATION` is the standard t3-env escape hatch for container
 * builds and CI steps that never read env at all.
 */
const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    GEMINI_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});

export default env;
export { loadEnv } from "./load-env.ts";
