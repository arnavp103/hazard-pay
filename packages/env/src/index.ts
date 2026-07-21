import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});

export default env;
