import type { Db } from "@hazard-pay/db";
import env from "@hazard-pay/env";
import { createLogger, type Logger } from "@hazard-pay/observability";
import { PgBoss } from "pg-boss";

import { createDb } from "./db/index.ts";

export type Env = typeof env;

/**
 * The application context (ADR 0002 §5): assembled exactly once at boot,
 * threaded to plain-function services as their first argument. Features
 * narrow it with `Pick` so every dependency is visible in the signature.
 * No DI container, no factory-closure service objects.
 */
export interface AppCtx {
  db: Db;
  logger: Logger;
  boss: PgBoss;
  env: Env;
}

export interface AppCtxHandle {
  ctx: AppCtx;
  /** Closes the db pool. The worker owns the pg-boss lifecycle separately. */
  close: () => Promise<void>;
}

export function createAppCtx(): AppCtxHandle {
  // Root logger at boot (ADR 0002 §6): the only pino constructed in this app.
  // Route and job adapters derive scoped children from it at the edges.
  const logger = createLogger("api");
  const { db, close } = createDb(env.DATABASE_URL);
  const boss = new PgBoss(env.DATABASE_URL);
  return { ctx: { db, logger, boss, env }, close };
}
