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
    // Full pino level set: `trace`/`fatal` for parity with the logger, and
    // `silent` so tests and scripts can carry a real logger with output off
    // (ADR 0002: tests build a hand-rolled ctx with a silent logger).
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
    DATABASE_URL: z.url().default("postgres://postgres:postgres@localhost:5433/hazard_pay"),
    // apps/api listen port and its public origin. `API_BASE_URL` is what
    // better-auth uses for cookies/redirects (#19: real `baseURL`); keep the
    // two in sync when overriding either.
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_BASE_URL: z.url().default("http://localhost:3000"),
    // better-auth's session/cookie signing secret (packages/auth). Dev-stub
    // only — real auth flows are out of scope for this map (wayfinder #1),
    // so this default is deliberately checked in and insecure.
    BETTER_AUTH_SECRET: z.string().default("dev-only-insecure-secret-do-not-use-in-production"),
    // Overworld tick cadence in milliseconds (ADR 0004 §4): 5-minute default,
    // headroom for a leader wake to usually finish within a tick. The tick
    // number is derived from wall clock / TICK_INTERVAL, so changing this
    // mid-history renumbers future ticks — fine for the walking skeleton.
    // pg-boss cron fires at whole-minute resolution; sub-minute intervals
    // are caught up in batches by the idempotent backfill, not by cron.
    TICK_INTERVAL: z.coerce.number().int().min(1000).default(300_000),
    GEMINI_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});

export default env;
export { loadEnv } from "./load-env.ts";
